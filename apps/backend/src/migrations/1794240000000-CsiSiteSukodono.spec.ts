import { CsiSiteSukodono1794240000000 } from './1794240000000-CsiSiteSukodono';

describe('CsiSiteSukodono migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiSiteSukodono1794240000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('inserts the active Sukodono site only when SKD does not exist yet', async () => {
        const sql = await run('up');
        expect(sql).toContain('INSERT INTO "sites"');
        expect(sql).toContain("'SKD'");
        expect(sql).toContain("'Sukodono'");
        expect(sql).toContain("'Asia/Jakarta'");
        expect(sql).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM "sites" WHERE "code" = 'SKD'\)/);
        expect(sql).not.toMatch(/UPDATE|DELETE/);
    });

    it('removes SKD on down only when nothing references it', async () => {
        const sql = await run('down');
        expect(sql).toContain('DELETE FROM "sites" WHERE "code" = \'SKD\'');
        expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "users" WHERE "siteId" = "sites"."id")');
    });
});
