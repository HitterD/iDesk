import { In, Repository } from 'typeorm';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import type { TicketRepliedEvent } from '../../ticketing/events/ticket-replied.event';
import type { TicketClosedReason } from '../../ticketing/events/ticket-updated.event';
import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { WebhookOutbox } from '../ipop/entities/webhook-outbox.entity';
import type { IpopTicketView } from '../ipop/ipop-ticket.service';
import type { IpopWebhookEvent } from '../ipop/ipop-webhook.service';

/** Status-specific events; every other status change goes out as `ticket.status_changed`. */
const STATUS_EVENT: Partial<Record<string, IpopWebhookEvent>> = {
    [TicketStatus.RESOLVED]: 'ticket.resolved',
    [TicketStatus.CLOSED]: 'ticket.closed',
};

/** Length of the chat preview a partner shows; the full message stays in iDesk. */
export const CHAT_PREVIEW_LENGTH = 100;
const HTML_ENTITIES: Readonly<Record<string, string>> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

export type EnqueueWebhook = (event: IpopWebhookEvent, view: IpopTicketView, extra?: Record<string, unknown>) => Promise<void>;

/** Actor id the auto-close cron records (TicketResolutionService SYSTEM_ACTOR_ID). */
const SYSTEM_ACTOR_ID = 'system';
const CLOSED_REASONS: readonly TicketClosedReason[] = ['auto_unconfirmed', 'confirmed', 'manual'];

/** What the iDesk event that triggered a report says about the change. */
export interface ChangeContext {
    /** iDesk user id of who made the change; null/'system' for the scheduler, auto-assign or when unknown. */
    actorId?: string | null;
    /** Set by the resolution flow when it closed the ticket. */
    closedReason?: TicketClosedReason;
    /** The requester's comment when they reopened (disputed) a resolved ticket. */
    reason?: string | null;
}

/** The person who caused a change, so a partner can say "Ditutup oleh …". */
export type WebhookActor = { nik: string | null; name: string | null } | null;

/**
 * Who caused a ticket event, read from its payload: `assignerId` of `ticket.assigned`, `userId` of
 * `ticket.updated` / `ticket.cancelled`. Auto-assign and merge events carry nobody.
 */
export function changeContextOf(
    event: { userId?: unknown; assignerId?: unknown; closedReason?: unknown; reason?: unknown } | null | undefined,
): ChangeContext {
    const actorId = typeof event?.assignerId === 'string' ? event.assignerId : typeof event?.userId === 'string' ? event.userId : null;
    const closedReason = CLOSED_REASONS.find((r) => r === event?.closedReason);
    const reason = typeof event?.reason === 'string' ? event.reason : null;
    return { actorId, ...(closedReason ? { closedReason } : {}), ...(reason ? { reason } : {}) };
}

/** Longest reopen comment a partner gets; the full text stays in the iDesk chat. */
export const REASON_LENGTH = 200;

function shortReason(reason: string | null | undefined): string | null {
    const text = (reason ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    return text.length > REASON_LENGTH ? `${text.slice(0, REASON_LENGTH - 1)}…` : text;
}

/**
 * Turns iDesk ticket events into callbacks for one partner (iPop, or a connected app). Status and assignee are
 * compared with the last snapshot sent to that partner instead of parsing event texts, so any code path that
 * changes a ticket (manual edit, resolve, auto-close, auto-assign) is reported once.
 */
export class TicketWebhookReporter {
    constructor(
        private readonly target: string,
        private readonly enqueue: EnqueueWebhook,
        private readonly outboxRepo: Repository<WebhookOutbox>,
        private readonly userRepo: Repository<User>,
    ) {}

    /** Auto-assign often runs before the async handler reads the ticket: report the as-created state, then diff. */
    async created(view: IpopTicketView, statusAtCreation?: string): Promise<void> {
        await this.enqueue('ticket.created', { ...view, status: statusAtCreation ?? view.status, assignee: null });
        await this.reportChanges(view);
    }

    /**
     * A reply can move TODO -> IN_PROGRESS (reported first), then a public message becomes a chat notification for
     * the other side: an ICT reply for the requester, a requester reply for the assigned agent. Recipients travel as
     * HRIS NIKs; the sender is never a recipient. Internal notes and system messages never leave iDesk.
     */
    async replied(view: IpopTicketView, event: TicketRepliedEvent): Promise<void> {
        const { message } = event;
        // A first agent reply starts the work (TODO -> IN_PROGRESS): that agent made the change.
        await this.reportChanges(view, { actorId: event.senderId });
        if (message.isInternal || message.isSystemMessage) return;
        // The requester side (requester, the staff who filed it, participants) — replyToTicket reports them as USER.
        const fromRequester = event.senderId === event.ticketOwnerId || event.senderRole === UserRole.USER;
        const recipientIds = (fromRequester ? [event.ticketAssignedToId] : [event.ticketOwnerId])
            .filter((id): id is string => !!id && id !== event.senderId);
        const recipients = await this.niksOf(recipientIds);
        if (recipients.length === 0) return;
        const attachmentCount = message.attachments?.length ?? 0;
        await this.enqueue('ticket.message_created', view, {
            message: {
                id: message.id,
                sender: { name: event.senderName },
                fromRequester,
                preview: chatPreview(message.content, attachmentCount),
                attachmentCount,
                attachments: attachmentKinds(message),
                createdAt: new Date(message.createdAt).toISOString(),
            },
            recipients,
        });
    }

    /** Only when a chat notification went to this reader since their last read event (page views refresh often). */
    async read(view: IpopTicketView, userId: string): Promise<void> {
        const [reader] = await this.niksOf([userId]);
        if (!reader || !(await this.hasUnclearedChat(view.ticketId, reader.nik))) return;
        // Its snapshot becomes the "last sent" one: report any status/assignee change first.
        await this.reportChanges(view);
        await this.enqueue('ticket.read', view, { reader });
    }

    /**
     * Emits only what differs from the last snapshot this partner received. `context` comes from the iDesk event
     * being handled: every change event carries `actor` (who did it; null for the system), `ticket.closed` also
     * `closedReason`.
     */
    async reportChanges(view: IpopTicketView, context: ChangeContext = {}): Promise<void> {
        const last = await this.lastSent(view.ticketId);
        const previousStatus = last?.status;
        const previousAssignee = last?.assignee?.name ?? null;
        const assignee = view.assignee?.name ?? null;
        const assigned = !!assignee && assignee !== previousAssignee;
        const statusChanged = !!previousStatus && view.status !== previousStatus;
        // Snapshots sent before `visit` existed have no such key: don't report those as moves.
        const visitMoved = !!last && 'visit' in last && !sameVisit(last.visit, view.visit);
        if (!assigned && !statusChanged && !visitMoved) return;
        const actor = await this.actorOf(context.actorId);

        if (assigned) {
            // Snapshots sent before the assignee NIK existed have none: null, as for an account without a NIK.
            await this.enqueue('ticket.assigned', view, { previousAssignee, previousAssigneeNik: last?.assignee?.nik ?? null, actor });
        }
        if (statusChanged) {
            const event = STATUS_EVENT[view.status] ?? 'ticket.status_changed';
            await this.enqueue(event, view, {
                previousStatus,
                actor,
                ...(event === 'ticket.closed' ? { closedReason: context.closedReason ?? 'manual' } : {}),
                // The requester's comment when they reopen (dispute) a resolved ticket; null for other moves.
                ...(event === 'ticket.status_changed' ? { reason: shortReason(context.reason) } : {}),
            });
        }
        if (visitMoved) {
            await this.enqueue('ticket.visit_changed', view, { previousVisit: last!.visit, actor });
        }
    }

    private async actorOf(actorId: string | null | undefined): Promise<WebhookActor> {
        if (!actorId || actorId === SYSTEM_ACTOR_ID) return null;
        const user = await this.userRepo.findOne({ where: { id: actorId }, select: ['id', 'employeeId', 'fullName'] });
        return user ? { nik: user.employeeId || null, name: user.fullName ?? null } : null;
    }

    private async lastSent(ticketId: string): Promise<IpopTicketView | null> {
        const row = await this.outboxRepo.findOne({ where: { target: this.target, ticketId }, order: { createdAt: 'DESC' } });
        return (row?.payload?.ticket as IpopTicketView | undefined) ?? null;
    }

    /** A chat event to this NIK newer than the last read event for them on this ticket. */
    private async hasUnclearedChat(ticketId: string, nik: string): Promise<boolean> {
        const recipient = JSON.stringify([{ nik }]);
        const reader = JSON.stringify({ nik });
        const lastRead = await this.outboxRepo.createQueryBuilder('o')
            .select('MAX(o.createdAt)', 'at')
            .where('o.target = :target AND o.ticketId = :ticketId AND o.event = :event', { target: this.target, ticketId, event: 'ticket.read' })
            .andWhere(`o.payload -> 'reader' @> CAST(:reader AS jsonb)`, { reader })
            .getRawOne<{ at: Date | null }>();
        const q = this.outboxRepo.createQueryBuilder('o')
            .where('o.target = :target AND o.ticketId = :ticketId AND o.event = :event', { target: this.target, ticketId, event: 'ticket.message_created' })
            .andWhere(`o.payload -> 'recipients' @> CAST(:recipient AS jsonb)`, { recipient });
        if (lastRead?.at) q.andWhere('o.createdAt > :since', { since: lastRead.at });
        return (await q.getCount()) > 0;
    }

    private async niksOf(userIds: string[]): Promise<{ nik: string }[]> {
        if (userIds.length === 0) return [];
        const users = await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'employeeId', 'isActive'] });
        return users.filter((u) => u.employeeId && u.isActive !== false).map((u) => ({ nik: u.employeeId! }));
    }
}

/**
 * Runs one ticket's handlers one after another: created/auto-assigned fire back to back, and each diff needs the
 * previous snapshot saved first.
 */
export class PerTicketQueue {
    private readonly queues = new Map<string, Promise<void>>();

    run(ticketId: string, task: () => Promise<void>): Promise<void> {
        const next = (this.queues.get(ticketId) ?? Promise.resolve()).then(task);
        this.queues.set(ticketId, next);
        return next.finally(() => {
            if (this.queues.get(ticketId) === next) this.queues.delete(ticketId);
        });
    }
}

function sameVisit(a: IpopTicketView['visit'] | undefined, b: IpopTicketView['visit']): boolean {
    return (a?.start ?? null) === (b?.start ?? null) && (a?.end ?? null) === (b?.end ?? null);
}

/** Plain-text preview of a chat message: markup stripped, cut to CHAT_PREVIEW_LENGTH. */
export function chatPreview(content: string | null | undefined, attachmentCount: number): string {
    const text = (content ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_m, name: string) => HTML_ENTITIES[name])
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return attachmentCount > 0 ? `📎 ${attachmentCount} lampiran` : '';
    return text.length > CHAT_PREVIEW_LENGTH ? `${text.slice(0, CHAT_PREVIEW_LENGTH - 1)}…` : text;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;

/** Kind and name of each attachment, so a partner can say "📎 Foto" / "📎 Video" / "📎 laporan.pdf". */
export function attachmentKinds(message: { attachments?: string[] | null; attachmentInfo?: { name: string; mime?: string }[] | null }): { name: string; kind: 'image' | 'video' | 'file' }[] {
    const names = message.attachmentInfo?.length
        ? message.attachmentInfo.map((a) => ({ name: a.name, mime: a.mime ?? '' }))
        : (message.attachments ?? []).map((p) => ({ name: p.split('/').pop() ?? p, mime: '' }));
    return names.map(({ name, mime }) => ({
        name,
        kind: mime.startsWith('image/') || IMAGE_EXT.test(name) ? 'image' : mime.startsWith('video/') || VIDEO_EXT.test(name) ? 'video' : 'file',
    }));
}
