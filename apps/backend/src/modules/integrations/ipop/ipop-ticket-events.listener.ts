import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import type { TicketRepliedEvent } from '../../ticketing/events/ticket-replied.event';
import { UserRole } from '../../users/enums/user-role.enum';
import { User } from '../../users/entities/user.entity';
import { WebhookOutbox } from './entities/webhook-outbox.entity';
import { IpopTicketService, IpopTicketView, isIpopVisible } from './ipop-ticket.service';
import { IPOP_TARGET, IpopWebhookEvent, IpopWebhookService } from './ipop-webhook.service';

/** Status-specific events; every other status change goes out as `ticket.status_changed`. */
const STATUS_EVENT: Partial<Record<string, IpopWebhookEvent>> = {
    [TicketStatus.RESOLVED]: 'ticket.resolved',
    [TicketStatus.CLOSED]: 'ticket.closed',
};

type TicketIdPayload = { ticketId?: string; ticket?: { id?: string } };

/** Length of the chat preview iPop shows; the full message stays in iDesk. */
export const IPOP_PREVIEW_LENGTH = 100;
const HTML_ENTITIES: Readonly<Record<string, string>> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/**
 * Turns iDesk ticket events into iPop callbacks. Status and assignee are compared with
 * the last snapshot sent to iPop instead of parsing event texts, so any code path that
 * changes a ticket (manual edit, resolve, auto-close, auto-assign) is reported once.
 */
@Injectable()
export class IpopTicketEventsListener {
    private readonly logger = new Logger(IpopTicketEventsListener.name);
    /** Per-ticket chain: created/auto-assigned fire back to back, and each diff needs the previous snapshot saved. */
    private readonly queues = new Map<string, Promise<void>>();

    constructor(
        private readonly tickets: IpopTicketService,
        private readonly webhooks: IpopWebhookService,
        @InjectRepository(WebhookOutbox) private readonly outboxRepo: Repository<WebhookOutbox>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) {}

    @OnEvent('ticket.created', { async: true })
    async onCreated(event: { ticketId: string; status?: string }): Promise<void> {
        await this.safely(event.ticketId, async (view) => {
            // Auto-assign runs right after creation, often before this async handler reads the
            // ticket: report the as-created state, then let the diff emit the assignment.
            const asCreated = { ...view, status: event.status ?? view.status, assignee: null };
            await this.webhooks.enqueue('ticket.created', asCreated);
            await this.reportChanges(view);
        });
    }

    @OnEvent('ticket.updated', { async: true })
    @OnEvent('ticket.assigned', { async: true })
    @OnEvent('ticket.auto-assigned', { async: true })
    @OnEvent('ticket.cancelled', { async: true })
    @OnEvent('ticket.merged', { async: true })
    async onChanged(event: TicketIdPayload): Promise<void> {
        const ticketId = event?.ticketId ?? event?.ticket?.id;
        if (!ticketId) return;
        await this.safely(ticketId, (view) => this.reportChanges(view));
    }

    /**
     * A reply can move TODO -> IN_PROGRESS (reported first), then a public message becomes a chat
     * notification for the other side: an ICT reply for the requester, a requester reply for the
     * assigned agent. Recipients travel as HRIS NIKs (the only key iPop matches on); the sender is
     * never a recipient. Internal notes and system messages never leave iDesk.
     */
    @OnEvent('ticket.replied', { async: true })
    async onReplied(event: TicketRepliedEvent): Promise<void> {
        const { message } = event;
        const notify = !message.isInternal && !message.isSystemMessage;
        await this.safely(event.ticketId, async (view) => {
            await this.reportChanges(view);
            if (!notify) return;
            // The requester side (requester, the staff who filed it, participants) — replyToTicket reports them as USER.
            const fromRequester = event.senderId === event.ticketOwnerId || event.senderRole === UserRole.USER;
            const recipientIds = (fromRequester ? [event.ticketAssignedToId] : [event.ticketOwnerId])
                .filter((id): id is string => !!id && id !== event.senderId);
            const recipients = await this.niksOf(recipientIds);
            if (recipients.length === 0) return;
            const attachmentCount = message.attachments?.length ?? 0;
            await this.webhooks.enqueue('ticket.message_created', view, {
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
        });
    }

    /**
     * Someone opened the ticket in iDesk: iPop clears that person's chat notifications for it. Only when a chat
     * notification was actually sent to them since their last read event, so page views and refreshes (every GET of
     * the ticket marks it read) don't flood the outbox.
     */
    @OnEvent('ticket.read', { async: true })
    async onRead(event: { ticketId: string; userId: string }): Promise<void> {
        await this.safely(event.ticketId, async (view) => {
            const [reader] = await this.niksOf([event.userId]);
            if (!reader || !(await this.hasUnclearedChat(event.ticketId, reader.nik))) return;
            // Its snapshot becomes the "last sent" one: report any status/assignee change first, as onReplied does.
            await this.reportChanges(view);
            await this.webhooks.enqueue('ticket.read', view, { reader });
        });
    }

    /** A chat event to this NIK newer than the last read event for them on this ticket. */
    private async hasUnclearedChat(ticketId: string, nik: string): Promise<boolean> {
        const recipient = JSON.stringify([{ nik }]);
        const reader = JSON.stringify({ nik });
        const lastRead = await this.outboxRepo.createQueryBuilder('o')
            .select('MAX(o.createdAt)', 'at')
            .where('o.target = :target AND o.ticketId = :ticketId AND o.event = :event', { target: IPOP_TARGET, ticketId, event: 'ticket.read' })
            .andWhere(`o.payload -> 'reader' @> CAST(:reader AS jsonb)`, { reader })
            .getRawOne<{ at: Date | null }>();
        const q = this.outboxRepo.createQueryBuilder('o')
            .where('o.target = :target AND o.ticketId = :ticketId AND o.event = :event', { target: IPOP_TARGET, ticketId, event: 'ticket.message_created' })
            .andWhere(`o.payload -> 'recipients' @> CAST(:recipient AS jsonb)`, { recipient });
        if (lastRead?.at) q.andWhere('o.createdAt > :since', { since: lastRead.at });
        return (await q.getCount()) > 0;
    }

    private async niksOf(userIds: string[]): Promise<{ nik: string }[]> {
        if (userIds.length === 0) return [];
        const users = await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'employeeId', 'isActive'] });
        return users.filter((u) => u.employeeId && u.isActive !== false).map((u) => ({ nik: u.employeeId! }));
    }

    /** Emits only what differs from the last snapshot iPop received. */
    async reportChanges(view: IpopTicketView): Promise<void> {
        const last = await this.lastSent(view.ticketId);
        const previousStatus = last?.status;
        const previousAssignee = last?.assignee?.name ?? null;
        const assignee = view.assignee?.name ?? null;

        if (assignee && assignee !== previousAssignee) {
            await this.webhooks.enqueue('ticket.assigned', view, { previousAssignee });
        }
        if (previousStatus && view.status !== previousStatus) {
            await this.webhooks.enqueue(STATUS_EVENT[view.status] ?? 'ticket.status_changed', view, { previousStatus });
        }
        // Snapshots sent before `visit` existed have no such key: don't report those as moves.
        if (last && 'visit' in last && !sameVisit(last.visit, view.visit)) {
            await this.webhooks.enqueue('ticket.visit_changed', view, { previousVisit: last.visit });
        }
    }

    private async lastSent(ticketId: string): Promise<IpopTicketView | null> {
        const row = await this.outboxRepo.findOne({
            where: { target: IPOP_TARGET, ticketId },
            order: { createdAt: 'DESC' },
        });
        return (row?.payload?.ticket as IpopTicketView | undefined) ?? null;
    }

    /** Only tickets iPop may see (iPop-filed, or a requester with a NIK); never breaks the iDesk flow. */
    private safely(ticketId: string, run: (view: IpopTicketView) => Promise<void>): Promise<void> {
        if (!this.webhooks.isEnabled()) return Promise.resolve();
        const next = (this.queues.get(ticketId) ?? Promise.resolve()).then(() => this.handle(ticketId, run));
        this.queues.set(ticketId, next);
        return next.finally(() => {
            if (this.queues.get(ticketId) === next) this.queues.delete(ticketId);
        });
    }

    private async handle(ticketId: string, run: (view: IpopTicketView) => Promise<void>): Promise<void> {
        try {
            const ticket = await this.tickets.loadTicket(ticketId);
            if (!ticket || !isIpopVisible(ticket)) return;
            await run(this.tickets.toView(ticket));
        } catch (error) {
            this.logger.error(`Could not queue iPop webhook for ticket ${ticketId}: ${(error as Error).message}`);
        }
    }
}

function sameVisit(a: IpopTicketView['visit'] | undefined, b: IpopTicketView['visit']): boolean {
    return (a?.start ?? null) === (b?.start ?? null) && (a?.end ?? null) === (b?.end ?? null);
}

/** Plain-text preview of a chat message: markup stripped, cut to IPOP_PREVIEW_LENGTH. */
export function chatPreview(content: string | null | undefined, attachmentCount: number): string {
    const text = (content ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_m, name: string) => HTML_ENTITIES[name])
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return attachmentCount > 0 ? `📎 ${attachmentCount} lampiran` : '';
    return text.length > IPOP_PREVIEW_LENGTH ? `${text.slice(0, IPOP_PREVIEW_LENGTH - 1)}…` : text;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;

/** Kind and name of each attachment, so iPop can say "📎 Foto" / "📎 Video" / "📎 laporan.pdf". */
export function attachmentKinds(message: { attachments?: string[] | null; attachmentInfo?: { name: string; mime?: string }[] | null }): { name: string; kind: 'image' | 'video' | 'file' }[] {
    const names = message.attachmentInfo?.length
        ? message.attachmentInfo.map((a) => ({ name: a.name, mime: a.mime ?? '' }))
        : (message.attachments ?? []).map((p) => ({ name: p.split('/').pop() ?? p, mime: '' }));
    return names.map(({ name, mime }) => ({
        name,
        kind: mime.startsWith('image/') || IMAGE_EXT.test(name) ? 'image' : mime.startsWith('video/') || VIDEO_EXT.test(name) ? 'video' : 'file',
    }));
}
