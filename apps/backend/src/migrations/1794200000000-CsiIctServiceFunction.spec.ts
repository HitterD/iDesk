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

    it('down removes only that column', async () => {
        expect(await run('down')).toBe('ALTER TABLE "csi_subject_profiles" DROP COLUMN IF EXISTS "serviceFunction"');
    });
});
