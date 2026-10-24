import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TicketRepliedEvent } from '../../ticketing/events/ticket-replied.event';
import { User } from '../../users/entities/user.entity';
import { WebhookOutbox } from '../ipop/entities/webhook-outbox.entity';
import { IPOP_SOURCE, IpopTicketService, IpopTicketView } from '../ipop/ipop-ticket.service';
import { PerTicketQueue, TicketWebhookReporter } from '../shared/ticket-webhook-reporter';
import { AppWebhookService } from './app-webhook.service';
import { IntegrationAppsService } from './integration-apps.service';
import { scopeOf } from './app-scope';

type TicketIdPayload = { ticketId?: string; ticket?: { id?: string } };

/** Same callbacks as iPop gets, for tickets a connected app filed, sent to that app's webhook URL. */
@Injectable()
export class AppTicketEventsListener {
    private readonly logger = new Logger(AppTicketEventsListener.name);
    private readonly queue = new PerTicketQueue();

    constructor(
        private readonly tickets: IpopTicketService,
        private readonly apps: IntegrationAppsService,
        private readonly webhooks: AppWebhookService,
        @InjectRepository(WebhookOutbox) private readonly outboxRepo: Repository<WebhookOutbox>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
    ) {}

    @OnEvent('ticket.created', { async: true })
    async onCreated(event: { ticketId: string; status?: string }): Promise<void> {
        await this.safely(event.ticketId, (reporter, view) => reporter.created(view, event.status));
    }

    @OnEvent('ticket.updated', { async: true })
    @OnEvent('ticket.assigned', { async: true })
    @OnEvent('ticket.auto-assigned', { async: true })
    @OnEvent('ticket.cancelled', { async: true })
    @OnEvent('ticket.merged', { async: true })
    async onChanged(event: TicketIdPayload): Promise<void> {
        const ticketId = event?.ticketId ?? event?.ticket?.id;
        if (!ticketId) return;
        await this.safely(ticketId, (reporter, view) => reporter.reportChanges(view));
    }

    @OnEvent('ticket.replied', { async: true })
    async onReplied(event: TicketRepliedEvent): Promise<void> {
        await this.safely(event.ticketId, (reporter, view) => reporter.replied(view, event));
    }

    @OnEvent('ticket.read', { async: true })
    async onRead(event: { ticketId: string; userId: string }): Promise<void> {
        await this.safely(event.ticketId, (reporter, view) => reporter.read(view, event.userId));
    }

    /** Only tickets filed by an active app that has a webhook URL; never breaks the iDesk flow. */
    private safely(ticketId: string, run: (reporter: TicketWebhookReporter, view: IpopTicketView) => Promise<void>): Promise<void> {
        return this.queue.run(ticketId, async () => {
            try {
                const ticket = await this.tickets.loadTicket(ticketId);
                const source = ticket?.externalSource;
                if (!ticket || !source || source === IPOP_SOURCE) return;
                const resolved = await this.apps.resolveBySource(source);
                if (!resolved?.app.webhookUrl) return;
                const reporter = new TicketWebhookReporter(
                    source, (event, view, extra) => this.webhooks.enqueue(source, event, view, extra), this.outboxRepo, this.userRepo,
                );
                await run(reporter, this.tickets.toView(ticket, scopeOf(resolved.app)));
            } catch (error) {
                this.logger.error(`Could not queue app webhook for ticket ${ticketId}: ${(error as Error).message}`);
            }
        });
    }
}
