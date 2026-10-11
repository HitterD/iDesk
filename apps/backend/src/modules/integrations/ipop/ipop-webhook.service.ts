import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { WebhookOutbox, WebhookOutboxStatus } from './entities/webhook-outbox.entity';
import { signedIpopHeaders } from './ipop-signature';
import type { IpopTicketView } from './ipop-ticket.service';

export const IPOP_TARGET = 'IPOP';

export type IpopWebhookEvent =
    | 'ticket.created'
    | 'ticket.assigned'
    | 'ticket.status_changed'
    | 'ticket.resolved'
    | 'ticket.closed'
    | 'ticket.message_created'
    | 'ticket.visit_changed'
    | 'zoom_booking.created'
    | 'zoom_booking.updated'
    | 'zoom_booking.cancelled';

/** Wait before attempt n+1 after n failures: 1m, 5m, 30m, 2h; then the row is FAILED. */
export const IPOP_RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000];
const DELIVERY_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 50;
const MAX_ERROR_LENGTH = 500;

/**
 * Signed status callbacks to iPop via an outbox: events are queued in the database and
 * delivered by a cron, so an iPop outage or a restart never loses an update.
 */
@Injectable()
export class IpopWebhookService {
    private readonly logger = new Logger(IpopWebhookService.name);
    private running = false;

    constructor(
        @InjectRepository(WebhookOutbox) private readonly outboxRepo: Repository<WebhookOutbox>,
        private readonly config: ConfigService,
    ) {}

    isEnabled(): boolean {
        return !!this.config.get<string>('IPOP_WEBHOOK_URL')?.trim();
    }

    async enqueue(event: IpopWebhookEvent, ticket: IpopTicketView, extra: Record<string, unknown> = {}): Promise<void> {
        await this.insert(event, ticket.ticketId, { ticket, ...extra });
    }

    /** Zoom booking callbacks: not tied to a ticket, the booking travels in the body. */
    async enqueueZoomBooking(event: IpopWebhookEvent, booking: object): Promise<void> {
        await this.insert(event, null, { booking });
    }

    private async insert(event: IpopWebhookEvent, ticketId: string | null, body: Record<string, unknown>): Promise<void> {
        if (!this.isEnabled()) return;
        await this.outboxRepo.save(this.outboxRepo.create({
            target: IPOP_TARGET,
            event,
            ticketId,
            payload: {
                id: randomUUID(), // delivery id: lets iPop drop duplicates after a retry
                event,
                occurredAt: new Date().toISOString(),
                ...body,
            },
            status: WebhookOutboxStatus.PENDING,
            nextAttemptAt: new Date(),
        }));
    }

    @Cron(CronExpression.EVERY_30_SECONDS, { name: 'ipop-webhook-dispatch' })
    async dispatchDue(): Promise<void> {
        if (this.running || !this.isEnabled()) return;
        this.running = true;
        try {
            const due = await this.outboxRepo.find({
                where: { target: IPOP_TARGET, status: WebhookOutboxStatus.PENDING, nextAttemptAt: LessThanOrEqual(new Date()) },
                order: { createdAt: 'ASC' },
                take: BATCH_SIZE,
            });
            // In creation order, so iPop sees a ticket's events in the order they happened.
            for (const row of due) await this.deliver(row);
        } finally {
            this.running = false;
        }
    }

    async deliver(row: WebhookOutbox, now: Date = new Date()): Promise<void> {
        const url = this.config.get<string>('IPOP_WEBHOOK_URL')!.trim();
        const clientId = this.config.get<string>('IPOP_CLIENT_ID')?.trim() || '';
        const secret = this.config.get<string>('IPOP_CLIENT_SECRET')?.trim() || '';
        const body = JSON.stringify(row.payload);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: signedIpopHeaders(clientId, secret, body, now.getTime()),
                body,
                signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await this.outboxRepo.update(row.id, {
                status: WebhookOutboxStatus.DELIVERED,
                attempts: row.attempts + 1,
                deliveredAt: now,
                lastError: null,
            });
        } catch (error) {
            const attempts = row.attempts + 1;
            const delay = IPOP_RETRY_DELAYS_MS[attempts - 1];
            const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
            await this.outboxRepo.update(row.id, {
                attempts,
                lastError: message,
                status: delay === undefined ? WebhookOutboxStatus.FAILED : WebhookOutboxStatus.PENDING,
                nextAttemptAt: new Date(now.getTime() + (delay ?? 0)),
            });
            if (delay === undefined) {
                this.logger.error(`iPop webhook ${row.event} (outbox ${row.id}) failed after ${attempts} attempts: ${message}`);
            }
        }
    }
}
