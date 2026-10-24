import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { WebhookOutbox, WebhookOutboxStatus } from '../ipop/entities/webhook-outbox.entity';
import { IPOP_RETRY_DELAYS_MS, IPOP_TARGET, IpopWebhookEvent } from '../ipop/ipop-webhook.service';
import { signIpopPayload } from '../ipop/ipop-signature';
import type { IpopTicketView } from '../ipop/ipop-ticket.service';
import { APP_HEADERS } from './integration-app.constants';
import { IntegrationAppsService } from './integration-apps.service';

const DELIVERY_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 50;
const MAX_ERROR_LENGTH = 500;

/** Headers of a signed callback to a connected app (same scheme it uses to call iDesk). */
export function signedAppHeaders(clientId: string, secret: string, body: string, now: number = Date.now()): Record<string, string> {
    const timestamp = String(now);
    return {
        'Content-Type': 'application/json',
        [APP_HEADERS.clientId]: clientId,
        [APP_HEADERS.timestamp]: timestamp,
        [APP_HEADERS.signature]: signIpopPayload(secret, timestamp, body),
    };
}

/**
 * Ticket callbacks to connected apps, through the same outbox as iPop (target = the app's ticket source, e.g.
 * 'EBBK'): queued in the database and delivered by a cron with retries, so an outage never loses an update.
 */
@Injectable()
export class AppWebhookService {
    private readonly logger = new Logger(AppWebhookService.name);
    private running = false;

    constructor(
        @InjectRepository(WebhookOutbox) private readonly outboxRepo: Repository<WebhookOutbox>,
        private readonly apps: IntegrationAppsService,
    ) {}

    async enqueue(target: string, event: IpopWebhookEvent, ticket: IpopTicketView, extra: Record<string, unknown> = {}): Promise<void> {
        await this.outboxRepo.save(this.outboxRepo.create({
            target,
            event,
            ticketId: ticket.ticketId,
            payload: { id: randomUUID(), event, occurredAt: new Date().toISOString(), ticket, ...extra },
            status: WebhookOutboxStatus.PENDING,
            nextAttemptAt: new Date(),
        }));
    }

    @Cron(CronExpression.EVERY_30_SECONDS, { name: 'app-webhook-dispatch' })
    async dispatchDue(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try {
            const due = await this.outboxRepo.find({
                where: { target: Not(IPOP_TARGET), status: WebhookOutboxStatus.PENDING, nextAttemptAt: LessThanOrEqual(new Date()) },
                order: { createdAt: 'ASC' },
                take: BATCH_SIZE,
            });
            // In creation order, so an app sees a ticket's events in the order they happened.
            for (const row of due) await this.deliver(row);
        } finally {
            this.running = false;
        }
    }

    async deliver(row: WebhookOutbox, now: Date = new Date()): Promise<void> {
        const resolved = await this.apps.resolveBySource(row.target);
        if (!resolved?.app.webhookUrl) {
            await this.outboxRepo.update(row.id, { status: WebhookOutboxStatus.FAILED, lastError: 'App disabled or webhook URL removed' });
            return;
        }
        const body = JSON.stringify(row.payload);
        try {
            const res = await fetch(resolved.app.webhookUrl, {
                method: 'POST',
                headers: signedAppHeaders(resolved.app.clientId, resolved.secret, body, now.getTime()),
                body,
                signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await this.outboxRepo.update(row.id, { status: WebhookOutboxStatus.DELIVERED, attempts: row.attempts + 1, deliveredAt: now, lastError: null });
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
            if (delay === undefined) this.logger.error(`${row.target} webhook ${row.event} (outbox ${row.id}) failed after ${attempts} attempts: ${message}`);
        }
    }
}
