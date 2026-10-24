import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EFormRequest, EFormStatus, EFormType } from '../entities/eform-request.entity';
import { EFORM_PROPOSER_ROLES } from '../eform-roles.constants';
import { HandlingTeam, Ticket, TICKET_INACTIVE_STATUSES } from '../../ticketing/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { isTicketRequesterSide, validateTicketAccess } from '../../ticketing/utils/oracle-ticket-access.util';
import { validateTicketSiteAccess } from '../../ticketing/utils/site-access.util';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { ProposeEFormFromTicketDto } from './propose-eform.dto';
import { TicketEFormLinkService } from './ticket-eform-link.service';
import { accessName, eformCode } from './eform-ticket.util';

/** Type-specific fields IT may prefill; everything else in `details` is ignored. */
const DETAIL_KEYS = ['kebutuhanAkses', 'proposedEmail', 'hostname', 'flashdiskInfo', 'folderPath'] as const;
const DETAIL_MAX = 300;

/** What the ticket's card shows about one e-form request proposed from it. */
export interface TicketEFormSummary {
    id: string;
    code: string;
    formType: EFormType;
    status: EFormStatus;
    note: string;
    requesterId: string;
    proposedBy: { id: string; name: string } | null;
    approverName: string | null;
    rejectionReason: string | null;
    createdAt: Date;
    submittedAt: Date | null;
    resolvedAt: Date | null;
}

/**
 * E-form access raised from an IT support ticket. IT proposes the access type and what it knows; the request stays
 * a draft until the requester completes, signs and submits it on the e-form page (which runs approval as usual).
 */
@Injectable()
export class TicketEFormService {
    constructor(
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(EFormRequest) private readonly repo: Repository<EFormRequest>,
        private readonly link: TicketEFormLinkService,
        private readonly notifications: NotificationService,
    ) {}

    async propose(actorId: string, ticketId: string, dto: ProposeEFormFromTicketDto): Promise<TicketEFormSummary> {
        const { actor, ticket } = await this.loadForStaff(actorId, ticketId);
        if (ticket.handlingTeam && ticket.handlingTeam !== HandlingTeam.OPS_SUPPORT) {
            throw new BadRequestException('Akses E-Form hanya bisa diusulkan dari tiket IT Support.');
        }
        if (TICKET_INACTIVE_STATUSES.includes(ticket.status)) {
            throw new BadRequestException('Tiket sudah selesai. Buka kembali tiket sebelum mengusulkan akses.');
        }
        const pending = await this.repo.findOne({ where: { sourceTicketId: ticket.id, status: EFormStatus.DRAFT } });
        if (pending) {
            throw new ConflictException(`Usulan ${accessName(pending.formType, pending.id)} masih menunggu pemohon.`);
        }
        const requester = await this.userRepo.findOne({ where: { id: ticket.userId }, relations: ['department'] });
        if (!requester) throw new BadRequestException('Pemohon tiket tidak ditemukan.');

        const draft = await this.repo.save(this.repo.create({
            formType: dto.formType,
            status: EFormStatus.DRAFT,
            requesterId: requester.id,
            requesterName: requester.fullName,
            requesterEmail: requester.email,
            requesterDepartment: requester.department?.name ?? '',
            formData: { alasan: dto.note, ...pickDetails(dto.details) },
            requestedWebsites: dto.formType === EFormType.WEBSITE ? dto.requestedWebsites || null : null,
            networkPurpose: dto.formType === EFormType.NETWORK ? dto.networkPurpose || null : null,
            termsAccepted: false,
            siteId: ticket.siteId ?? requester.siteId ?? null,
            sourceTicketId: ticket.id,
            proposedById: actor.id,
        } as Partial<EFormRequest>));

        await this.link.record(draft.id, 'PROPOSED', { actorId: actor.id });
        await this.notifications.create({
            userId: requester.id,
            type: NotificationType.TICKET_UPDATED,
            title: 'Usulan akses dari tim IT',
            message: `Tiket #${ticket.ticketNumber}: ${actor.fullName} mengusulkan ${accessName(draft.formType, draft.id)}. Lengkapi dan tanda tangani.`,
            ticketId: ticket.id,
            link: `/tickets/${ticket.id}`,
        });
        const [summary] = await this.summarize([draft.id]);
        return summary;
    }

    async listForTicket(viewerId: string, ticketId: string): Promise<TicketEFormSummary[]> {
        const viewer = await this.userRepo.findOne({ where: { id: viewerId } });
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!viewer || !ticket) throw new NotFoundException('Tiket tidak ditemukan');
        if (!isTicketRequesterSide(viewer.id, ticket)) this.assertStaffAccess(viewer, ticket);
        const rows = await this.repo.find({ where: { sourceTicketId: ticket.id }, select: { id: true }, order: { createdAt: 'ASC' } });
        return this.summarize(rows.map((row) => row.id));
    }

    /** The requester declines an unsigned proposal, or IT withdraws it. */
    async cancelProposal(userId: string, requestId: string): Promise<TicketEFormSummary> {
        const request = await this.repo.findOne({ where: { id: requestId } });
        if (!request?.sourceTicketId) throw new NotFoundException('Usulan akses tidak ditemukan');
        const isRequester = request.requesterId === userId;
        if (!isRequester) await this.loadForStaff(userId, request.sourceTicketId);
        if (request.status !== EFormStatus.DRAFT) throw new BadRequestException('Usulan ini sudah diajukan atau dibatalkan.');
        request.status = EFormStatus.CANCELLED;
        await this.repo.save(request);
        await this.link.record(request.id, isRequester ? 'DECLINED' : 'WITHDRAWN', { actorId: userId });
        const [summary] = await this.summarize([request.id]);
        return summary;
    }

    private async loadForStaff(actorId: string, ticketId: string): Promise<{ actor: User; ticket: Ticket }> {
        const actor = await this.userRepo.findOne({ where: { id: actorId } });
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['participants'] });
        if (!actor || !ticket) throw new NotFoundException('Tiket tidak ditemukan');
        if (!EFORM_PROPOSER_ROLES.includes(actor.role as UserRole)) {
            throw new ForbiddenException('Hanya tim IT yang bisa mengusulkan akses E-Form.');
        }
        this.assertStaffAccess(actor, ticket);
        return { actor, ticket };
    }

    private assertStaffAccess(user: User, ticket: Ticket): void {
        validateTicketAccess(user, ticket);
        validateTicketSiteAccess(user.role as UserRole, user.siteId ?? null, ticket.siteId ?? null);
    }

    private async summarize(ids: string[]): Promise<TicketEFormSummary[]> {
        if (ids.length === 0) return [];
        const requests = await this.repo.find({ where: { id: In(ids) }, relations: ['currentApprover'], order: { createdAt: 'ASC' } });
        const proposerIds = [...new Set(requests.map((r) => r.proposedById).filter((id): id is string => !!id))];
        const proposers = proposerIds.length ? await this.userRepo.find({ where: { id: In(proposerIds) }, select: { id: true, fullName: true } }) : [];
        return requests.map((request) => {
            const proposer = proposers.find((u) => u.id === request.proposedById);
            return {
                id: request.id,
                code: eformCode(request.id),
                formType: request.formType,
                status: request.status,
                note: String(request.formData?.alasan ?? ''),
                requesterId: request.requesterId,
                proposedBy: proposer ? { id: proposer.id, name: proposer.fullName } : null,
                approverName: request.currentApprover?.fullName ?? null,
                rejectionReason: request.rejectionReason || null,
                createdAt: request.createdAt,
                submittedAt: request.submittedAt ?? null,
                resolvedAt: request.resolvedAt ?? null,
            };
        });
    }
}

function pickDetails(details: Record<string, unknown> | undefined): Record<string, string> {
    const picked: Record<string, string> = {};
    for (const key of DETAIL_KEYS) {
        const value = details?.[key];
        if (typeof value === 'string' && value.trim()) picked[key] = value.trim().slice(0, DETAIL_MAX);
    }
    return picked;
}
