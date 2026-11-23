import { QueryRunner } from 'typeorm';
import { HardwareFlowColumns1794830000000 } from './1794830000000-HardwareFlowColumns';

describe('HardwareFlowColumns migration', () => {
    const run = async (direction: 'up' | 'down', existingTypes: string[]) => {
        const queries: string[] = [];
        const runner = {
            query: async (sql: string, params?: unknown[]) => {
                queries.push(sql);
                if (sql.includes('pg_type')) return [{ exists: existingTypes.includes(String(params?.[0])) }];
                return [];
            },
        };
        await new HardwareFlowColumns1794830000000()[direction](runner as unknown as QueryRunner);
        return queries;
    };

    it('adds the schedule note and the per-item recipient column', async () => {
        const queries = await run('up', []);
        expect(queries).toContain(`ALTER TABLE "installation_schedules" ADD COLUMN IF NOT EXISTS "note" text`);
        expect(queries).toContain(`ALTER TABLE "hardware_request_items" ADD COLUMN IF NOT EXISTS "recipient_name" character varying(120)`);
    });

    it('adds the aging type to whichever notification enum names exist, and never uses it', async () => {
        const queries = await run('up', ['notification_type_enum']);
        const alters = queries.filter((q) => q.includes('HARDWARE_REQUEST_AGING'));
        expect(alters).toEqual([`ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'HARDWARE_REQUEST_AGING'`]);
        expect(queries.some((q) => /^\s*(INSERT|UPDATE)/i.test(q))).toBe(false);
    });

    it('handles both enum names', async () => {
        const queries = await run('up', ['notifications_type_enum', 'notification_type_enum']);
        expect(queries.filter((q) => q.includes('HARDWARE_REQUEST_AGING'))).toHaveLength(2);
    });

    it('drops the columns on rollback and keeps the enum value', async () => {
        const queries = await run('down', []);
        expect(queries).toEqual([
            `ALTER TABLE "hardware_request_items" DROP COLUMN IF EXISTS "recipient_name"`,
            `ALTER TABLE "installation_schedules" DROP COLUMN IF EXISTS "note"`,
        ]);
    });
});
