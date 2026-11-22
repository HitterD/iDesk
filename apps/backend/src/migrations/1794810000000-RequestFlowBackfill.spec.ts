import { QueryRunner } from 'typeorm';
import { TicketType } from '../modules/ticketing/entities/ticket.entity';
import { BACKFILL_SQL } from '../modules/request-flow/services/request-flow-backfill';
import { RequestFlowBackfill1794810000000 } from './1794810000000-RequestFlowBackfill';

describe('RequestFlowBackfill migration', () => {
    const run = async () => {
        const queries: string[] = [];
        const query = async (sql: string) => { queries.push(sql); return []; };
        const runner = { query, manager: { query } };
        await new RequestFlowBackfill1794810000000().up(runner as unknown as QueryRunner);
        return queries;
    };

    it('recreates the ticket type enum with every current type before backfilling', async () => {
        const queries = await run();
        const create = queries.find((q) => q.startsWith('CREATE TYPE "tickets_tickettype_enum"'))!;
        for (const type of Object.values(TicketType)) expect(create).toContain(`'${type}'`);
        expect(queries.indexOf('DROP TYPE "tickets_tickettype_enum_old"')).toBeLessThan(queries.indexOf(BACKFILL_SQL.selectHardware));
    });

    it('keeps the backfilled data on rollback', async () => {
        await expect(new RequestFlowBackfill1794810000000().down()).resolves.toBeUndefined();
    });
});
