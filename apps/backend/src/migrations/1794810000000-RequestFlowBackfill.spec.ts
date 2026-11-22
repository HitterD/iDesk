import { QueryRunner } from 'typeorm';
import { BACKFILL_SQL } from '../modules/request-flow/services/request-flow-backfill';
import {
    DISABLE_STATEMENT_TIMEOUT, RequestFlowBackfill1794810000000, SELECT_TICKET_TYPES,
} from './1794810000000-RequestFlowBackfill';

/** As stored: pg_enum order, with the two values ADDed by 1794800000000 in this same transaction. */
const STORED_TYPES = ['SERVICE', 'ICT_BUDGET', 'LOST_ITEM', 'HARDWARE_REQUEST', 'EFORM_REQUEST'];

describe('RequestFlowBackfill migration', () => {
    const run = async (labels: string[] = STORED_TYPES) => {
        const queries: string[] = [];
        const query = async (sql: string) => {
            queries.push(sql);
            return sql === SELECT_TICKET_TYPES ? labels.map((enumlabel) => ({ enumlabel })) : [];
        };
        const runner = { query, manager: { query } };
        await new RequestFlowBackfill1794810000000().up(runner as unknown as QueryRunner);
        return queries;
    };

    it('reads the ticket types from pg_enum, keeping their stored order', async () => {
        const queries = await run();
        expect(SELECT_TICKET_TYPES).toBe(
            `SELECT enumlabel FROM pg_enum WHERE enumtypid = '"tickets_tickettype_enum"'::regtype ORDER BY enumsortorder`,
        );
        expect(queries[0]).toBe(SELECT_TICKET_TYPES);
        expect(queries).toContain(
            `CREATE TYPE "tickets_tickettype_enum" AS ENUM ('SERVICE', 'ICT_BUDGET', 'LOST_ITEM', 'HARDWARE_REQUEST', 'EFORM_REQUEST')`,
        );
    });

    it('lifts the statement timeout before rewriting the tickets column', async () => {
        const queries = await run();
        const alter = queries.findIndex((q) => q.startsWith('ALTER TABLE "tickets" ALTER COLUMN "ticketType" TYPE'));
        expect(DISABLE_STATEMENT_TIMEOUT).toBe('SET LOCAL statement_timeout = 0');
        expect(queries.indexOf(DISABLE_STATEMENT_TIMEOUT)).toBeGreaterThan(-1);
        expect(queries.indexOf(DISABLE_STATEMENT_TIMEOUT)).toBeLessThan(alter);
    });

    it('swaps the type in order and restores the default before backfilling', async () => {
        const queries = await run();
        const at = (prefix: string) => queries.findIndex((q) => q.startsWith(prefix));
        const order = [
            at('ALTER TYPE "tickets_tickettype_enum" RENAME TO "tickets_tickettype_enum_old"'),
            at('CREATE TYPE "tickets_tickettype_enum"'),
            at('ALTER TABLE "tickets" ALTER COLUMN "ticketType" DROP DEFAULT'),
            at('ALTER TABLE "tickets" ALTER COLUMN "ticketType" TYPE "tickets_tickettype_enum" USING "ticketType"::text::"tickets_tickettype_enum"'),
            at(`ALTER TABLE "tickets" ALTER COLUMN "ticketType" SET DEFAULT 'SERVICE'`),
            at('DROP TYPE "tickets_tickettype_enum_old"'),
            queries.indexOf(BACKFILL_SQL.selectHardware),
        ];
        expect(order.every((i) => i >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('refuses to recreate an enum it could not read', async () => {
        await expect(run([])).rejects.toThrow('has no values');
    });

    it('keeps the backfilled data on rollback', async () => {
        await expect(new RequestFlowBackfill1794810000000().down()).resolves.toBeUndefined();
    });
});
