import { CsiResponseDrafts1794650000000 } from './1794650000000-CsiResponseDrafts';

describe('CsiResponseDrafts migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiResponseDrafts1794650000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('creates csi_response_drafts with cascade FKs and unique (periodId, respondentId) index', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_response_drafts"');
        expect(sql).toContain('REFERENCES "csi_periods"("id") ON DELETE CASCADE');
        expect(sql).toContain('REFERENCES "users"("id") ON DELETE CASCADE');
        expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_response_drafts_period_respondent"');
    });

    it('drops the table on down', async () => {
        expect(await run('down')).toBe('DROP TABLE IF EXISTS "csi_response_drafts"');
    });
});
