import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { pickRole } from '../guards/hardware-role.guard';
import { HardwareRequestType, ProposeFromTicketDto, REQUEST_TYPE_PREFIX } from '../dto/propose-from-ticket.dto';
import { HardwareRequestCommandService } from './hardware-request-command.service';
import { TicketHardwareLinkService } from './ticket-hardware-link.service';
import { HandlingTeam, Ticket, TICKET_INACTIVE_STATUSES } from '../../ticketing/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { isTicketRequesterSide, validateTicketAccess } from '../../ticketing/utils/oracle-ticket-access.util';
import { validateTicketSiteAccess } from '../../ticketing/utils/site-access.util';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

/** What the ticket's card shows about one linked hardware request. */
export interface TicketHardwareRequestSummary {
    id: string;
    requestNumber: string;
    status: RequestStatus;
    requestType: HardwareRequestType;
    justification: string;
    rejectReason: string | null;
    requesterId: string;
    proposedBy: { id: string; name: string } | null;
    items: Array<{ name: string; category: string | null; quantity: number }>;
    /** How many of the procured units have arrived; ICT schedules the installation once they all have. */
    delivery: { arrived: number; total: number };
    /** Latest installation schedule: the requester confirms a single proposal or picks one of `slots` from the ticket. */
    schedule: {
        id: string;
        start: string | null;
        end: string | null;
        status: string;
        proposedById: string | null;
        slots: Array<{ start: string; end: string }>;
    } | null;
    createdAt: Date;
    submittedAt: Date | null;
    approvedAt: Date | null;
    procuredAt: Date | null;
    installMarkedDoneAt: Date | null;
    completedAt: Date | null;
}

const TYPE_BY_PREFIX = Object.entries(REQUEST_TYPE_PREFIX) as Array<[HardwareRequestType, string]>;

export function requestTypeOf(justification: string | null | undefined): HardwareRequestType {
    const found = TYPE_BY_PREFIX.find(([, prefix]) => String(justification ?? '').startsWith(prefix));
    return found ? found[0] : HardwareRequestType.BUDGET_ANNUAL;
}

const stripPrefix = (justification: string) => justification.replace(/^\[[^\]]+\]\s*/, '');

/**
 * Hardware requests raised from an IT support ticket. ICT proposes the flow and the items on the requester's
 * behalf; the request stays a draft until the requester confirms it from the ticket (which submits it).
 */
@Injectable()
export class TicketHardwareRequestService {
    constructor(
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(HardwareRequest) private readonly reqRepo: Repository<HardwareRequest>,
        @InjectRepository(InstallationSchedule) private readonly schedRepo: Repository<InstallationSchedule>,
        private readonly commands: HardwareRequestCommandService,
        private readonly link: TicketHardwareLinkService,
        private readonly notifications: NotificationService,
    ) {}

    async propose(actorId: string, ticketId: string, dto: ProposeFromTicketDto): Promise<TicketHardwareRequestSummary> {
        const { actor, ticket } = await this.loadForStaff(actorId, ticketId);
        if (ticket.handlingTeam && ticket.handlingTeam !== HandlingTeam.OPS_SUPPORT) {
            throw new BadRequestException('Hardware request hanya bisa diusulkan dari tiket IT Support.');
        }
        if (TICKET_INACTIVE_STATUSES.includes(ticket.status)) {
            throw new BadRequestException('Tiket sudah selesai. Buka kembali tiket sebelum mengusulkan hardware.');
        }
        const pending = await this.reqRepo.findOne({ where: { sourceTicketId: ticket.id, status: RequestStatus.DRAFT } });
        if (pending) {
            throw new ConflictException(`Usulan ${pending.requestNumber} masih menunggu konfirmasi pemohon.`);
        }
        const requester = await this.userRepo.findOne({ where: { id: ticket.userId }, relations: ['department'] });
        if (!requester) throw new BadRequestException('Pemohon tiket tidak ditemukan.');
        const siteId = ticket.siteId ?? requester.siteId ?? null;

        const draft = await this.commands.createDraft(requester.id, siteId, requester.role as UserRole, {
            recipientId: requester.id,
            recipientName: requester.fullName,
            division: dto.division?.trim() || requester.department?.name || undefined,
            justification: `${REQUEST_TYPE_PREFIX[dto.requestType]} ${dto.justification.trim()}`,
            items: dto.items.map((item) => ({ catalogId: item.catalogId, quantity: item.quantity, notes: item.notes })),
        }, { sourceTicketId: ticket.id, proposedById: actor.id });

        await this.link.record(draft.id, 'PROPOSED', { actorId: actor.id });
        await this.notifications.create({
            userId: requester.id,
            type: NotificationType.TICKET_UPDATED,
            title: 'Usulan hardware dari tim IT',
            message: `Tiket #${ticket.ticketNumber}: ${actor.fullName} mengusulkan ${draft.requestNumber}. Mohon konfirmasi.`,
            ticketId: ticket.id,
            link: `/tickets/${ticket.id}`,
        });
        const [summary] = await this.summarize([draft.id]);
        return summary;
    }

    async listForTicket(viewerId: string, ticketId: string): Promise<TicketHardwareRequestSummary[]> {
        const viewer = await this.userRepo.findOne({ where: { id: viewerId } });
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!viewer || !ticket) throw new NotFoundException('Tiket tidak ditemukan');
        if (!isTicketRequesterSide(viewer.id, ticket)) this.assertStaffAccess(viewer, ticket);
        const rows = await this.reqRepo.find({ where: { sourceTicketId: ticket.id }, select: { id: true }, order: { createdAt: 'ASC' } });
        return this.summarize(rows.map((row) => row.id));
    }

    private async loadForStaff(actorId: string, ticketId: string): Promise<{ actor: User; ticket: Ticket }> {
        const actor = await this.userRepo.findOne({ where: { id: actorId } });
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!actor || !ticket) throw new NotFoundException('Tiket tidak ditemukan');
        if (pickRole(actor) !== HardwareRole.ICT_STAFF) {
            throw new ForbiddenException('Hanya tim IT yang bisa mengusulkan hardware request.');
        }
        this.assertStaffAccess(actor, ticket);
        return { actor, ticket };
    }

    private assertStaffAccess(user: User, ticket: Ticket): void {
        validateTicketAccess(user, ticket);
        validateTicketSiteAccess(user.role as UserRole, user.siteId ?? null, ticket.siteId ?? null);
    }

    private async summarize(ids: string[]): Promise<TicketHardwareRequestSummary[]> {
        if (ids.length === 0) return [];
        const requests = await this.reqRepo.find({ where: { id: In(ids) }, relations: { items: true }, order: { createdAt: 'ASC' } });
        const schedules = await this.schedRepo.find({ where: { requestId: In(ids) }, order: { createdAt: 'DESC' } });
        const proposerIds = [...new Set(requests.map((r) => r.proposedById).filter((id): id is string => !!id))];
        const proposers = proposerIds.length ? await this.userRepo.find({ where: { id: In(proposerIds) }, select: { id: true, fullName: true } }) : [];
        return requests.map((request) => {
            const schedule = schedules.find((s) => s.requestId === request.id);
            const proposer = proposers.find((u) => u.id === request.proposedById);
            return {
                id: request.id,
                requestNumber: request.requestNumber,
                status: request.status,
                requestType: requestTypeOf(request.justification),
                justification: stripPrefix(request.justification ?? ''),
                rejectReason: request.rejectReason,
                requesterId: request.requesterId,
                proposedBy: proposer ? { id: proposer.id, name: proposer.fullName } : null,
                items: groupItems(request),
                delivery: deliveryOf(request),
                schedule: schedule ? {
                    id: schedule.id,
                    start: schedule.scheduledStart?.toISOString() ?? null,
                    end: schedule.scheduledEnd?.toISOString() ?? null,
                    status: schedule.status,
                    proposedById: schedule.proposedBy ?? null,
                    slots: schedule.proposedSlots ?? [],
                } : null,
                createdAt: request.createdAt,
                submittedAt: request.submittedAt,
                approvedAt: request.approvedAt,
                procuredAt: request.procuredAt,
                installMarkedDoneAt: request.installMarkedDoneAt,
                completedAt: request.completedAt,
            };
        });
    }
}

/** Units that are being (or were) procured, and how many are already there. */
function deliveryOf(request: HardwareRequest): TicketHardwareRequestSummary['delivery'] {
    const procured = (request.items ?? []).filter((item) => item.deliveryStatus !== 'NOT_PROCURED');
    return { arrived: procured.filter((item) => item.deliveryStatus === 'ARRIVED').length, total: procured.length };
}

/** Items are stored one row per unit; the card lists them per catalog entry with a count. */
function groupItems(request: HardwareRequest): TicketHardwareRequestSummary['items'] {
    const byCatalog = new Map<string, { name: string; category: string | null; quantity: number }>();
    for (const item of request.items ?? []) {
        const snapshot = (item.categorySnapshot ?? {}) as { name?: string; category?: string };
        const key = item.catalogId ?? snapshot.name ?? item.id;
        const entry = byCatalog.get(key) ?? { name: snapshot.name ?? 'Perangkat', category: snapshot.category ?? null, quantity: 0 };
        entry.quantity += item.quantity || 1;
        byCatalog.set(key, entry);
    }
    return [...byCatalog.values()];
}
