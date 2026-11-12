import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { PushChannelService } from './channels/push-channel.service';
import { runOncePerPeriod } from '../../shared/core/utils/run-exclusive';
import { DEFAULT_TIMEZONE, localDateKey } from '../sla-config/business-hours.calc';

const DAY_MS = 86_400_000;
/** Read notifications are kept this long; the bell only shows recent ones. */
export const READ_RETENTION_DAYS = 90;
/** Unread ones a little longer, in case someone is away. */
export const UNREAD_RETENTION_DAYS = 180;
/** Delivery logs are for troubleshooting only. */
export const LOG_RETENTION_DAYS = 30;
/** Push subscriptions that stopped working are dropped after this. */
export const DEAD_PUSH_SUBSCRIPTION_DAYS = 7;
/** Rows deleted per statement, so one cleanup never locks the table for long. */
const BATCH = 5_000;

/**
 * Nightly cleanup so notification tables do not grow forever (they were never pruned, and the bell slowed down
 * with them). Critical notices still waiting for acknowledgement are never deleted. Runs once per night across
 * replicas.
 */
@Injectable()
export class NotificationRetentionService {
    private readonly logger = new Logger(NotificationRetentionService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly push: PushChannelService,
    ) { }

    @Cron('30 2 * * *', { timeZone: 'Asia/Jakarta', name: 'notification-retention' })
    async runNightly(now: Date = new Date()): Promise<void> {
        try {
            const result = await runOncePerPeriod(this.dataSource, 'notification-retention', localDateKey(now, DEFAULT_TIMEZONE), () => this.prune(now));
            if (result) this.logger.log(`Notification cleanup: ${JSON.stringify(result)}`);
        } catch (error) {
            this.logger.error(`Notification cleanup failed: ${(error as Error).message}`);
        }
    }

    async prune(now: Date): Promise<{ notifications: number; logs: number; subscriptions: number; jobRuns: number }> {
        const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
        const logs = await this.deleteInBatches(`DELETE FROM "notification_logs" WHERE ctid IN (
            SELECT ctid FROM "notification_logs" WHERE "createdAt" < $1 LIMIT ${BATCH})`, [before(LOG_RETENTION_DAYS)]);
        // Their remaining logs go with them (ON DELETE CASCADE).
        const notifications = await this.deleteInBatches(`DELETE FROM "notifications" WHERE ctid IN (
            SELECT n.ctid FROM "notifications" n WHERE ${STALE_NOTIFICATION_SQL} LIMIT ${BATCH})`,
        [before(READ_RETENTION_DAYS), before(UNREAD_RETENTION_DAYS)]);
        const subscriptions = await this.push.cleanupInactiveSubscriptions(DEAD_PUSH_SUBSCRIPTION_DAYS);
        const jobRuns = await this.deleteInBatches(`DELETE FROM "scheduled_job_runs" WHERE ctid IN (
            SELECT ctid FROM "scheduled_job_runs" WHERE "ranAt" < $1 LIMIT ${BATCH})`, [before(LOG_RETENTION_DAYS)]);
        return { notifications, logs, subscriptions, jobRuns };
    }

    private async deleteInBatches(sql: string, params: unknown[]): Promise<number> {
        let total = 0;
        for (;;) {
            const result = await this.dataSource.query(sql, params);
            const affected = Array.isArray(result) ? Number(result[1] ?? 0) : 0;
            total += affected;
            if (affected < BATCH) return total;
        }
    }
}

/** Old read rows, very old unread rows; never a critical notice still waiting to be acknowledged. */
const STALE_NOTIFICATION_SQL = `((n."isRead" = true AND n."createdAt" < $1) OR (n."isRead" = false AND n."createdAt" < $2))
    AND NOT (n."requiresAcknowledge" = true AND n."acknowledgedAt" IS NULL)`;
