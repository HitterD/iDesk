import { MigrationInterface, QueryRunner } from 'typeorm';
import {
    addBusinessMinutes,
    businessMinutesBetween,
    BusinessSchedule,
    DEFAULT_TIMEZONE,
    endOfNextBusinessDay,
} from '../modules/sla-config/business-hours.calc';
import { DEFAULT_HOLIDAYS } from '../modules/sla-config/default-holidays';

const MS_PER_MINUTE = 60_000;
const OPEN_STATUSES = ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED'];
const HELD_STATUSES = ['WAITING_VENDOR', 'RESOLVED'];

interface SlaRow {
    priority: string;
    resolutionTimeMinutes: number;
    responseTimeMinutes: number;
    businessHoursOnly: boolean;
}

interface TicketRow {
    id: string;
    status: string;
    priority: string;
    isHardwareInstallation: boolean;
    totalPausedMinutes: number;
    createdAt: string;
    slaStartedAt: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    waitingVendorAt: string | null;
    scheduledDate: string | null;
    extendedMinutes: number;
}

/** `timestamp` columns hold UTC wall time (the app runs with TZ=UTC); read them as text to stay TZ-independent. */
const utc = (value: string | null): Date | null => (value ? new Date(`${value}Z`) : null);
const toUtcText = (value: Date | null): string | null => (value ? value.toISOString().replace('Z', '') : null);
const ts = (column: string) => `to_char(t."${column}", 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "${column}"`;

/**
 * SLA counts working time only (Mon-Fri 08:00-17:00 Asia/Jakarta, minus admin
 * holidays) unless the priority opts out (CRITICAL by default).
 *
 * - sla_configs.businessHoursOnly, tickets.slaRemainingMinutes / firstResponseRemainingMinutes
 * - business_hours table guaranteed (it used to be created by synchronize) and the
 *   hardcoded holiday list merged into it once
 * - targets of open tickets re-projected with the new rules; closed tickets untouched
 */
export class SlaBusinessHours1793000000000 implements MigrationInterface {
    name = 'SlaBusinessHours1793000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sla_configs" ADD COLUMN IF NOT EXISTS "businessHoursOnly" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`UPDATE "sla_configs" SET "businessHoursOnly" = false WHERE "priority" = 'CRITICAL'`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "slaRemainingMinutes" integer NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "firstResponseRemainingMinutes" integer NULL`);

        const schedule = await this.ensureBusinessHours(queryRunner);
        await this.recalculateOpenTickets(queryRunner, schedule);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "firstResponseRemainingMinutes"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "slaRemainingMinutes"`);
        await queryRunner.query(`ALTER TABLE "sla_configs" DROP COLUMN IF EXISTS "businessHoursOnly"`);
    }

    private async ensureBusinessHours(queryRunner: QueryRunner): Promise<BusinessSchedule> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "business_hours" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL DEFAULT 'default',
                "isDefault" boolean NOT NULL DEFAULT true,
                "workDays" text NOT NULL DEFAULT '[1,2,3,4,5]',
                "startTime" integer NOT NULL DEFAULT 480,
                "endTime" integer NOT NULL DEFAULT 1020,
                "timezone" character varying NOT NULL DEFAULT '${DEFAULT_TIMEZONE}',
                "holidays" text DEFAULT '[]',
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_business_hours_id" PRIMARY KEY ("id")
            )`);

        const rows: Array<{ id: string; workDays: string; startTime: number; endTime: number; timezone: string; holidays: string | null }> =
            await queryRunner.query(`SELECT "id", "workDays", "startTime", "endTime", "timezone", "holidays" FROM "business_hours" WHERE "isDefault" = true LIMIT 1`);

        if (rows.length === 0) {
            await queryRunner.query(
                `INSERT INTO "business_hours" ("name", "isDefault", "workDays", "startTime", "endTime", "timezone", "holidays") VALUES ('default', true, '[1,2,3,4,5]', 480, 1020, $1, $2)`,
                [DEFAULT_TIMEZONE, JSON.stringify(DEFAULT_HOLIDAYS)],
            );
            return { workDays: [1, 2, 3, 4, 5], startTime: 480, endTime: 1020, timezone: DEFAULT_TIMEZONE, holidays: [...DEFAULT_HOLIDAYS] };
        }

        const row = rows[0];
        const existing: string[] = row.holidays ? JSON.parse(row.holidays) : [];
        const holidays = Array.from(new Set([...existing, ...DEFAULT_HOLIDAYS])).sort();
        await queryRunner.query(`UPDATE "business_hours" SET "holidays" = $1 WHERE "id" = $2`, [JSON.stringify(holidays), row.id]);
        return {
            workDays: JSON.parse(row.workDays),
            startTime: row.startTime,
            endTime: row.endTime,
            timezone: row.timezone || DEFAULT_TIMEZONE,
            holidays,
        };
    }

    private async recalculateOpenTickets(queryRunner: QueryRunner, schedule: BusinessSchedule): Promise<void> {
        const configs: SlaRow[] = await queryRunner.query(
            `SELECT "priority", "resolutionTimeMinutes", "responseTimeMinutes", "businessHoursOnly" FROM "sla_configs"`,
        );
        const byPriority = new Map(configs.map(c => [c.priority, c]));

        const tickets: TicketRow[] = await queryRunner.query(`
            SELECT t."id", t."status", t."priority", t."isHardwareInstallation", t."totalPausedMinutes",
                   ${['createdAt', 'slaStartedAt', 'firstResponseAt', 'resolvedAt', 'waitingVendorAt', 'scheduledDate'].map(ts).join(', ')},
                   COALESCE((SELECT SUM(a."minutes") FROM "sla_adjustments" a WHERE a."ticketId" = t."id"), 0)::int AS "extendedMinutes"
            FROM "tickets" t
            WHERE t."deletedAt" IS NULL AND t."status"::text = ANY($1)`, [OPEN_STATUSES]);

        const now = new Date();
        for (const ticket of tickets) {
            const update = ticket.isHardwareInstallation
                ? this.hardwareUpdate(ticket, schedule, now)
                : this.standardUpdate(ticket, byPriority.get(ticket.priority), schedule, now);
            if (!update) continue;

            const columns = Object.keys(update);
            await queryRunner.query(
                `UPDATE "tickets" SET ${columns.map((c, i) => `"${c}" = $${i + 2}`).join(', ')} WHERE "id" = $1`,
                [ticket.id, ...columns.map(c => update[c])],
            );
        }
    }

    private hardwareUpdate(ticket: TicketRow, schedule: BusinessSchedule, now: Date): Record<string, unknown> | null {
        const scheduled = utc(ticket.scheduledDate);
        if (!scheduled) return null;
        const target = endOfNextBusinessDay(scheduled, schedule);
        return {
            slaTarget: toUtcText(target),
            ...(target > now ? { isOverdue: false } : {}),
        };
    }

    private standardUpdate(ticket: TicketRow, config: SlaRow | undefined, schedule: BusinessSchedule, now: Date): Record<string, unknown> | null {
        if (!config) return null;
        const add = (start: Date, minutes: number) => config.businessHoursOnly
            ? addBusinessMinutes(start, minutes, schedule)
            : new Date(start.getTime() + Math.max(0, minutes) * MS_PER_MINUTE);
        const between = (start: Date, end: Date) => config.businessHoursOnly
            ? businessMinutesBetween(start, end, schedule)
            : Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE));

        const held = HELD_STATUSES.includes(ticket.status);
        // The clock froze when the ticket entered its current paused state.
        const clockEnd = held
            ? utc(ticket.status === 'RESOLVED' ? ticket.resolvedAt : ticket.waitingVendorAt) ?? now
            : now;
        const update: Record<string, unknown> = {};

        if (!ticket.firstResponseAt) {
            const createdAt = utc(ticket.createdAt)!;
            const target = add(createdAt, config.responseTimeMinutes);
            update.firstResponseTarget = toUtcText(target);
            if (held) {
                const left = Math.max(0, config.responseTimeMinutes - between(createdAt, clockEnd));
                update.firstResponseRemainingMinutes = left;
                if (left > 0) update.isFirstResponseBreached = false;
            } else if (target > now) {
                update.isFirstResponseBreached = false;
            }
        }

        const startedAt = utc(ticket.slaStartedAt);
        if (startedAt) {
            // Earlier pauses were tracked in wall-clock minutes; subtracting them only ever gives the ticket more time.
            const used = Math.max(0, between(startedAt, clockEnd) - (ticket.totalPausedMinutes || 0));
            const left = Math.max(0, config.resolutionTimeMinutes + ticket.extendedMinutes - used);
            if (held) {
                update.slaRemainingMinutes = left;
                if (left > 0) update.isOverdue = false;
            } else {
                const target = add(now, left);
                update.slaTarget = toUtcText(target);
                if (target > now) update.isOverdue = false;
            }
        }

        return Object.keys(update).length ? update : null;
    }
}
