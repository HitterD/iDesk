import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { ACCESS_COOKIE_NAME } from '../../auth/presentation/cookie-options';
import { canAccessTicketObject } from '../utils/oracle-ticket-access.util';
import { canAccessTicketSite } from '../utils/site-access.util';

/** Directory under the upload root that holds ticket chat attachments. */
export const TICKET_UPLOAD_DIR = 'tickets';
/** Stored file names are `<stamp>-<rand>.<ext>`; anything else cannot be a ticket attachment. */
const SAFE_FILE_NAME = /^[\w.-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Upper bound on messages inspected per file; a stored name is random, so real matches are 1-2. */
const MAX_MATCHING_MESSAGES = 20;

export interface AttachmentViewer {
    id: string;
    role: UserRole;
    siteId: string | null;
}

export type AttachmentAccess =
    | { ok: true; downloadName: string | null }
    | { ok: false; status: 403 | 404 };

type MatchedMessage = Pick<TicketMessage, 'ticketId' | 'isInternal' | 'attachments' | 'attachmentInfo'>;

/** Splits `tickets/<dir>/<file>` into its parts; null for anything else. */
export function parseTicketUploadPath(relPath: string): { dir: string; fileName: string } | null {
    const parts = relPath.split(/[/\\]/);
    if (parts.length !== 3 || parts[0] !== TICKET_UPLOAD_DIR) return null;
    const [, dir, fileName] = parts;
    if (!dir || !SAFE_FILE_NAME.test(fileName)) return null;
    return { dir, fileName };
}

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');
const baseName = (storedPath: string): string => storedPath.split('/').pop() ?? '';

/**
 * Decides whether a signed-in user may download a ticket chat attachment, using
 * the rules for opening the ticket (`TicketQueryService.findOne`) plus: requesters
 * only reach their own or joined tickets, and never internal-note attachments.
 */
@Injectable()
export class TicketAttachmentAccessService {
    constructor(
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage) private readonly messageRepo: Repository<TicketMessage>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    /** Reads the access token from the auth cookie or a Bearer header; null when absent or invalid. */
    authenticate(req: Request): AttachmentViewer | null {
        const [scheme, headerToken] = (req.headers.authorization ?? '').split(' ');
        const token: string | undefined =
            req.cookies?.[ACCESS_COOKIE_NAME] || (scheme === 'Bearer' ? headerToken : undefined);
        if (!token) return null;
        try {
            const payload = this.jwtService.verify<{ sub?: string; role?: UserRole; type?: string; siteId?: string | null }>(
                token,
                { secret: this.configService.getOrThrow<string>('JWT_SECRET') },
            );
            if (!payload.sub || !payload.role || payload.type !== 'access') return null;
            return { id: payload.sub, role: payload.role, siteId: payload.siteId ?? null };
        } catch {
            return null;
        }
    }

    /** `relPath` is the file's path under the upload root, e.g. `tickets/<id>/<file>`. */
    async authorize(viewer: AttachmentViewer, relPath: string): Promise<AttachmentAccess> {
        const parsed = parseTicketUploadPath(relPath);
        if (!parsed) return { ok: false, status: 404 };

        const messages = await this.findMessagesWithFile(parsed.fileName);
        if (messages.length === 0) return this.authorizeOrphan(viewer, parsed.dir);

        const visible = messages.filter((m) => !m.isInternal || viewer.role !== UserRole.USER);
        if (visible.length === 0) return { ok: false, status: 403 };

        let found = false;
        for (const message of visible) {
            const ticket = await this.loadTicket(message.ticketId);
            if (!ticket) continue;
            found = true;
            if (this.canView(viewer, ticket)) {
                return { ok: true, downloadName: this.originalName(message, parsed.fileName) };
            }
        }
        return { ok: false, status: found ? 403 : 404 };
    }

    /** A file no message points at (e.g. pre-dating attachment tracking): fall back to its folder's ticket. */
    private async authorizeOrphan(viewer: AttachmentViewer, dir: string): Promise<AttachmentAccess> {
        if (!UUID_RE.test(dir)) {
            return viewer.role === UserRole.ADMIN ? { ok: true, downloadName: null } : { ok: false, status: 404 };
        }
        const ticket = await this.loadTicket(dir);
        if (!ticket) return { ok: false, status: 404 };
        return this.canView(viewer, ticket) ? { ok: true, downloadName: null } : { ok: false, status: 403 };
    }

    private async findMessagesWithFile(fileName: string): Promise<MatchedMessage[]> {
        const candidates = await this.messageRepo
            .createQueryBuilder('msg')
            .select(['msg.id', 'msg.ticketId', 'msg.isInternal', 'msg.attachments', 'msg.attachmentInfo'])
            .where('msg.attachments LIKE :pattern', { pattern: `%/${escapeLike(fileName)}"%` })
            .take(MAX_MATCHING_MESSAGES)
            .getMany();
        // LIKE only narrows; confirm the exact stored name.
        return candidates.filter((m) => (m.attachments ?? []).some((p) => baseName(p) === fileName));
    }

    private loadTicket(id: string): Promise<Ticket | null> {
        return this.ticketRepo.findOne({ where: { id }, relations: ['participants'] });
    }

    private canView(viewer: AttachmentViewer, ticket: Ticket): boolean {
        if (!canAccessTicketObject(viewer, ticket)) return false;
        const isOwner = ticket.userId === viewer.id;
        const isParticipant = ticket.participants?.some((p) => p.userId === viewer.id) ?? false;
        if (isOwner || isParticipant) return true;
        // Requesters only see their own tickets (as in the `join:ticket` socket check).
        return viewer.role !== UserRole.USER && canAccessTicketSite(viewer.role, viewer.siteId, ticket.siteId);
    }

    private originalName(message: MatchedMessage, fileName: string): string | null {
        return message.attachmentInfo?.find((info) => baseName(info.path) === fileName)?.name ?? null;
    }
}
