import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, QueryFailedError, Repository } from 'typeorm';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { Ticket, TicketSource, TicketType, TICKET_INACTIVE_STATUSES } from '../../ticketing/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { TicketCreateService } from '../../ticketing/services/ticket-create.service';
import { CreateTicketDto } from '../../ticketing/dto/create-ticket.dto';
import type { AttachmentInfo } from '../../ticketing/entities/ticket-message.entity';
import { ATTACHMENT_EXTENSIONS, validateFileMagicBytes } from '../../../shared/core/validators/magic-bytes.validator';
import { UPLOAD_ROOT } from '../../ticketing/presentation/interceptors/attachment-upload.interceptor';
import { IpopCatalogService } from './ipop-catalog.service';
import { IPOP_MAX_ATTACHMENT_BYTES, IpopAttachmentDto, IpopCreateTicketDto, IpopTicketQueryDto } from './dto/ipop-ticket.dto';

export const IPOP_SOURCE = 'IPOP';
/** Ticket types a requester never sees in iDesk "My Tickets"; iPop mirrors that view. */
const HIDDEN_FROM_REQUESTER: TicketType[] = [TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION];
const MAX_LIST = 100;
const PG_UNIQUE_VIOLATION = '23505';

/** What iPop may see of a ticket: progress only, never chat, attachments or internal notes. */
export interface IpopTicketView {
    ticketId: string;
    ticketNumber: string;
    externalRef: string | null;
    /** Where the ticket was filed: through iPop, or directly in iDesk. */
    origin: 'IPOP' | 'IDESK';
    /** Owner of the ticket, so iPop can attach iDesk-filed tickets to the right user. */
    requester: { nik: string | null; name: string | null };
    status: string;
    priority: string;
    module: string;
    category: string;
    title: string;
    assignee: { name: string } | null;
    slaTarget: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    closedAt: string | null;
    url: string;
}

export interface IpopCreateResult {
    created: boolean;
    ticket: IpopTicketView;
}

@Injectable()
export class IpopTicketService {
    private readonly logger = new Logger(IpopTicketService.name);

    constructor(
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly catalog: IpopCatalogService,
        private readonly ticketCreate: TicketCreateService,
        private readonly config: ConfigService,
    ) {}

    async create(dto: IpopCreateTicketDto): Promise<IpopCreateResult> {
        // Idempotent: a retried request (timeout, network blip) returns the first ticket.
        const existing = await this.findByRef(dto.externalRef);
        if (existing) return { created: false, ticket: this.toView(existing) };

        const requester = await this.resolveRequester(dto.requester);
        const route = await this.catalog.resolveRoute(dto.module, dto.category);
        const saved = await this.storeAttachments(dto.attachments ?? []);

        const createDto: CreateTicketDto = {
            title: dto.title,
            description: dto.description,
            priority: dto.priority,
            category: route.category,
            ticketType: route.ticketType,
            source: TicketSource.IPOP,
            device: dto.device,
            software: dto.software,
            criticalReason: dto.criticalReason,
            isHardwareInstallation: route.isHardwareInstallation || undefined,
            scheduledDate: route.isHardwareInstallation ? dto.scheduledDate : undefined,
            scheduledTime: route.isHardwareInstallation ? dto.scheduledTime : undefined,
            hardwareType: route.isHardwareInstallation ? dto.hardwareType : undefined,
            userAcknowledged: route.isHardwareInstallation || undefined,
        } as CreateTicketDto;

        try {
            const ticket = await this.ticketCreate.createTicket(
                requester.id,
                createDto,
                saved.map((a) => a.path),
                saved,
                { source: IPOP_SOURCE, ref: dto.externalRef },
            );
            const full = await this.loadTicket(ticket.id);
            this.logger.log(`iPop ${dto.externalRef} -> ticket ${ticket.ticketNumber} (${route.module.slug})`);
            return { created: true, ticket: this.toView(full ?? ticket) };
        } catch (error) {
            await this.discard(saved);
            // Two concurrent retries: the unique (externalSource, externalRef) index lets one win.
            if (error instanceof QueryFailedError && (error as any).driverError?.code === PG_UNIQUE_VIOLATION) {
                const winner = await this.findByRef(dto.externalRef);
                if (winner) return { created: false, ticket: this.toView(winner) };
            }
            throw error;
        }
    }

    async getByNumber(ticketNumber: string): Promise<IpopTicketView> {
        const ticket = await this.ticketRepo.findOne({ where: { ticketNumber }, relations: VIEW_RELATIONS });
        if (!ticket || !isIpopVisible(ticket)) throw new NotFoundException(`No ticket ${ticketNumber} visible to iPop`);
        return this.toView(ticket);
    }

    async find(query: IpopTicketQueryDto): Promise<IpopTicketView[]> {
        if (query.externalRef) {
            const ticket = await this.findByRef(query.externalRef);
            return ticket ? [this.toView(ticket)] : [];
        }
        if (!query.nik) {
            throw new BadRequestException('Provide externalRef or nik');
        }
        const user = await this.userRepo.findOne({ where: { employeeId: query.nik }, select: ['id'] });
        if (!user) return [];
        // Every ticket of this requester (filed in iPop or in iDesk), as in iDesk "My Tickets".
        const tickets = await this.ticketRepo.find({
            where: {
                userId: user.id,
                ticketType: Not(In(HIDDEN_FROM_REQUESTER)),
                ...(query.state === 'open' ? { status: Not(In(TICKET_INACTIVE_STATUSES)) } : {}),
            },
            relations: VIEW_RELATIONS,
            order: { createdAt: 'DESC' },
            take: MAX_LIST,
        });
        return tickets.map((t) => this.toView(t));
    }

    /** Public progress view (also the webhook payload). */
    toView(ticket: Ticket): IpopTicketView {
        const base = (this.config.get<string>('FRONTEND_URL') || '').split(',')[0].trim().replace(/\/$/, '');
        return {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            externalRef: ticket.externalRef ?? null,
            origin: ticket.externalSource === IPOP_SOURCE ? 'IPOP' : 'IDESK',
            requester: { nik: ticket.user?.employeeId ?? null, name: ticket.user?.fullName ?? null },
            status: ticket.status,
            priority: ticket.priority,
            module: moduleSlugOf(ticket),
            category: ticket.category,
            title: ticket.title,
            assignee: ticket.assignedTo ? { name: ticket.assignedTo.fullName } : null,
            slaTarget: ticket.slaTarget ? new Date(ticket.slaTarget).toISOString() : null,
            createdAt: new Date(ticket.createdAt).toISOString(),
            updatedAt: new Date(ticket.updatedAt).toISOString(),
            resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt).toISOString() : null,
            closedAt: ticket.closedAt ? new Date(ticket.closedAt).toISOString() : null,
            url: `${base}/client/tickets/${ticket.id}`,
        };
    }

    loadTicket(id: string): Promise<Ticket | null> {
        return this.ticketRepo.findOne({ where: { id }, relations: VIEW_RELATIONS });
    }

    private findByRef(externalRef: string): Promise<Ticket | null> {
        return this.ticketRepo.findOne({
            where: { externalSource: IPOP_SOURCE, externalRef },
            relations: VIEW_RELATIONS,
        });
    }

    /** The iPop user must already exist in iDesk (HRIS is the single source of users). */
    private async resolveRequester(requester: { nik?: string; email?: string }): Promise<User> {
        const user = requester.nik
            ? await this.userRepo.findOne({ where: { employeeId: requester.nik } })
            : await this.userRepo.findOne({ where: { email: requester.email!.toLowerCase() } });
        if (!user) {
            throw new UnprocessableEntityException('Requester is not registered in iDesk (match by NIK/email failed)');
        }
        if (!user.isActive) {
            throw new UnprocessableEntityException('Requester account is inactive in iDesk');
        }
        return user;
    }

    /** Decodes, size/type-checks and writes the base64 attachments; all-or-nothing. */
    private async storeAttachments(files: IpopAttachmentDto[]): Promise<AttachmentInfo[]> {
        if (files.length === 0) return [];
        const dir = join(UPLOAD_ROOT, 'tickets', 'ipop');
        await mkdir(dir, { recursive: true });
        const saved: AttachmentInfo[] = [];
        try {
            for (const file of files) {
                const ext = extname(file.fileName).toLowerCase();
                if (!ATTACHMENT_EXTENSIONS.includes(ext)) {
                    throw new BadRequestException(`File type of "${file.fileName}" is not allowed (${ATTACHMENT_EXTENSIONS.join(', ')})`);
                }
                const buffer = Buffer.from(file.contentBase64, 'base64');
                if (buffer.length === 0 || buffer.length > IPOP_MAX_ATTACHMENT_BYTES) {
                    throw new BadRequestException(`"${file.fileName}" must be between 1 byte and 10 MB`);
                }
                if (!validateFileMagicBytes({ originalname: file.fileName, buffer } as Express.Multer.File)) {
                    throw new BadRequestException(`"${file.fileName}" content does not match its extension`);
                }
                const name = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}${ext}`;
                await writeFile(join(dir, name), buffer);
                saved.push({
                    path: `/uploads/tickets/ipop/${name}`,
                    name: file.fileName.slice(0, 200),
                    size: buffer.length,
                    mime: mimeOf(ext),
                });
            }
            return saved;
        } catch (error) {
            await this.discard(saved);
            throw error;
        }
    }

    private async discard(files: AttachmentInfo[]): Promise<void> {
        await Promise.all(files.map((f) => unlink(join(UPLOAD_ROOT, f.path.replace(/^\/uploads\//, ''))).catch(() => undefined)));
    }
}

const VIEW_RELATIONS = ['assignedTo', 'user'];

/**
 * Tickets iPop may read and be notified about: filed through iPop, or filed in iDesk for
 * a requester with a NIK (the link to the iPop user), excluding types the requester does
 * not see in iDesk either.
 */
export function isIpopVisible(ticket: Pick<Ticket, 'externalSource' | 'ticketType'> & { user?: { employeeId?: string | null } | null }): boolean {
    if (ticket.externalSource === IPOP_SOURCE) return true;
    if (HIDDEN_FROM_REQUESTER.includes(ticket.ticketType as TicketType)) return false;
    return !!ticket.user?.employeeId;
}

const MODULE_BY_TEAM: Readonly<Record<string, string>> = {
    ORACLE_DEV: 'oracle-k2',
    WEB_DEV: 'web-developer',
    MOBILE_DEV: 'mobile-developer',
};

/** Module slug of a ticket, from its handling team (tickets are routed by team). */
export function moduleSlugOf(ticket: Pick<Ticket, 'handlingTeam'>): string {
    return MODULE_BY_TEAM[ticket.handlingTeam as string] ?? 'it-support';
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
    '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function mimeOf(ext: string): string {
    return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}
