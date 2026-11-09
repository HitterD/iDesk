import { CsiIctServiceFunction1794200000000 } from './1794200000000-CsiIctServiceFunction';

describe('CsiIctServiceFunction migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiIctServiceFunction1794200000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds a nullable service function to subject profiles only', async () => {
        const sql = await run('up');
        expect(sql).toMatch(/ALTER TABLE "csi_subject_profiles"\s+ADD COLUMN IF NOT EXISTS "serviceFunction" varchar\(150\) NULL/);
        expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM|^\s*UPDATE\b/m);
    });

    it('adds a per-survey self results flag that is off for every existing survey', async () => {
        expect(await run('up')).toMatch(/ALTER TABLE "csi_periods"\s+ADD COLUMN IF NOT EXISTS "selfResults" boolean NOT NULL DEFAULT false/);
    });

    it('down removes only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('ALTER TABLE "csi_subject_profiles" DROP COLUMN IF EXISTS "serviceFunction"');
        expect(sql).toContain('ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "selfResults"');
    });
});
