import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TicketRepliedEvent } from '../../ticketing/events/ticket-replied.event';
import { User } from '../../users/entities/user.entity';
import { WebhookOutbox } from './entities/webhook-outbox.entity';
import { IpopTicketService, IpopTicketView, isIpopVisible } from './ipop-ticket.service';
import { IPOP_TARGET, IpopWebhookService } from './ipop-webhook.service';
import { ChangeContext, PerTicketQueue, TicketWebhookReporter, changeContextOf } from '../shared/ticket-webhook-reporter';

export { CHAT_PREVIEW_LENGTH as IPOP_PREVIEW_LENGTH, attachmentKinds, chatPreview } from '../shared/ticket-webhook-reporter';

/** Any ticket change event; the actor travels as `userId` (updated, cancelled) or `assignerId` (assigned). */
type TicketIdPayload = { ticketId?: string; ticket?: { id?: string }; userId?: string; assignerId?: string; closedReason?: string; reason?: string };

/** Turns iDesk ticket events into iPop callbacks (logic shared with connected apps in TicketWebhookReporter). */
@Injectable()
export class IpopTicketEventsListener {
    private readonly logger = new Logger(IpopTicketEventsListener.name);
    private readonly queue = new PerTicketQueue();
    private readonly reporter: TicketWebhookReporter;

    constructor(
        private readonly tickets: IpopTicketService,
        private readonly webhooks: IpopWebhookService,
        @InjectRepository(WebhookOutbox) outboxRepo: Repository<WebhookOutbox>,
        @InjectRepository(User) userRepo: Repository<User>,
    ) {
        this.reporter = new TicketWebhookReporter(IPOP_TARGET, this.webhooks.enqueue.bind(this.webhooks), outboxRepo, userRepo);
    }

    @OnEvent('ticket.created', { async: true })
    async onCreated(event: { ticketId: string; status?: string }): Promise<void> {
        await this.safely(event.ticketId, (view) => this.reporter.created(view, event.status));
    }

    @OnEvent('ticket.updated', { async: true })
    @OnEvent('ticket.assigned', { async: true })
    @OnEvent('ticket.auto-assigned', { async: true })
    @OnEvent('ticket.cancelled', { async: true })
    @OnEvent('ticket.merged', { async: true })
    async onChanged(event: TicketIdPayload): Promise<void> {
        const ticketId = event?.ticketId ?? event?.ticket?.id;
        if (!ticketId) return;
        await this.safely(ticketId, (view) => this.reporter.reportChanges(view, changeContextOf(event)));
    }

    @OnEvent('ticket.replied', { async: true })
    async onReplied(event: TicketRepliedEvent): Promise<void> {
        await this.safely(event.ticketId, (view) => this.reporter.replied(view, event));
    }

    /** Someone opened the ticket in iDesk: iPop clears that person's chat notifications for it. */
    @OnEvent('ticket.read', { async: true })
    async onRead(event: { ticketId: string; userId: string }): Promise<void> {
        await this.safely(event.ticketId, (view) => this.reporter.read(view, event.userId));
    }

    /** Emits only what differs from the last snapshot iPop received. */
    reportChanges(view: IpopTicketView, context?: ChangeContext): Promise<void> {
        return this.reporter.reportChanges(view, context);
    }

    /** Only tickets iPop may see (iPop-filed, or a requester with a NIK); never breaks the iDesk flow. */
    private safely(ticketId: string, run: (view: IpopTicketView) => Promise<void>): Promise<void> {
        if (!this.webhooks.isEnabled()) return Promise.resolve();
        return this.queue.run(ticketId, () => this.handle(ticketId, run));
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
