import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import type { TicketRepliedEvent } from '../../ticketing/events/ticket-replied.event';
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
     * A reply can move TODO -> IN_PROGRESS (reported first), and a public message from
     * anyone but the requester becomes a chat notification. Internal notes and system
     * messages never leave iDesk.
     */
    @OnEvent('ticket.replied', { async: true })
    async onReplied(event: TicketRepliedEvent): Promise<void> {
        const { message } = event;
        const notify = !message.isInternal && !message.isSystemMessage && event.senderId !== event.ticketOwnerId;
        await this.safely(event.ticketId, async (view) => {
            await this.reportChanges(view);
            if (!notify) return;
            const attachmentCount = message.attachments?.length ?? 0;
            await this.webhooks.enqueue('ticket.message_created', view, {
                message: {
                    id: message.id,
                    sender: { name: event.senderName },
                    preview: chatPreview(message.content, attachmentCount),
                    attachmentCount,
                    createdAt: new Date(message.createdAt).toISOString(),
                },
            });
        });
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
