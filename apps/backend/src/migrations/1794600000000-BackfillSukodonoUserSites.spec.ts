import { BackfillSukodonoUserSites1794600000000 } from './1794600000000-BackfillSukodonoUserSites';

describe('BackfillSukodonoUserSites migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new BackfillSukodonoUserSites1794600000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries;
    };

    it('looks up SKD and SPJ by code and moves matching active SJA3 directory users to SKD', async () => {
        const queries = await run('up');
        expect(queries).toHaveLength(1);
        const [sql] = queries;
        expect(sql).toMatch(/UPDATE "users" u\s+SET "siteId" = skd\."id"/);
        expect(sql).toMatch(/skd\."code" = 'SKD'/);
        expect(sql).toMatch(/spj\."code" = 'SPJ'/);
        expect(sql).toMatch(/u\."isActive" = true/);
        expect(sql).toMatch(/LPAD\(BTRIM\(u\."employeeId"\), 8, '0'\)/);
        expect(sql).toMatch(/'SJA3'/);
        expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it('leaves down() as a safe no-op', async () => {
        expect(await run('down')).toEqual([]);
    });
});
