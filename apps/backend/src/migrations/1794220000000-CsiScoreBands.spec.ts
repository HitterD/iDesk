import { CsiScoreBands1794220000000 } from './1794220000000-CsiScoreBands';

describe('CsiScoreBands migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiScoreBands1794220000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds the two band columns with the legacy defaults, additively', async () => {
        const sql = await run('up');
        expect(sql).toContain('ALTER TABLE "csi_periods"');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS "scoreFairMin" numeric(2,1) NOT NULL DEFAULT 4.0');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS "scoreGoodMin" numeric(2,1) NOT NULL DEFAULT 4.5');
        expect(sql).not.toMatch(/DROP|DELETE FROM|^\s*UPDATE\b/m);
    });

    it('drops the columns on down', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP COLUMN IF EXISTS "scoreFairMin"');
        expect(sql).toContain('DROP COLUMN IF EXISTS "scoreGoodMin"');
    });
});
