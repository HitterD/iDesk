import { QueryRunner } from 'typeorm';
import { EformPendingReview1794820000000 } from './1794820000000-EformPendingReview';

describe('EformPendingReview migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        const runner = { query: async (sql: string) => { queries.push(sql); } };
        await new EformPendingReview1794820000000()[direction](runner as unknown as QueryRunner);
        return queries;
    };

    // Only the value is added: Postgres refuses to use a value added in the same transaction, and TypeORM runs every
    // pending migration in one transaction.
    it('only adds PENDING_REVIEW to the e-form status enum', async () => {
        expect(await run('up')).toEqual([`ALTER TYPE "eform_requests_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`]);
    });

    it('leaves the value in place on rollback', async () => {
        expect(await run('down')).toEqual([]);
    });
});
