import { SiteHandledBy1794250000000 } from './1794250000000-SiteHandledBy';

describe('SiteHandledBy migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new SiteHandledBy1794250000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries;
    };

    it('adds a nullable self-reference that is cleared when the handling site is deleted', async () => {
        const [addColumn] = await run('up');
        expect(addColumn).toMatch(/ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "handledBySiteId" uuid NULL/);
        expect(addColumn).toMatch(/REFERENCES "sites"\("id"\) ON DELETE SET NULL/);
    });

    it('makes Sepanjang handle Sukodono, looked up by code (ids differ per database)', async () => {
        const sql = (await run('up')).join('\n');
        expect(sql).toMatch(/UPDATE "sites" SET "handledBySiteId" = \(SELECT "id" FROM "sites" WHERE "code" = 'SPJ'\)\s+WHERE "code" = 'SKD'/);
        expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    });

    it.each(['tickets', 'hardware_requests', 'agent_daily_workload'])(
        'moves %s already filed under Sukodono to Sepanjang, only when both sites exist',
        async (table) => {
            const sql = (await run('up')).find((q) => q.includes(`UPDATE "${table}"`) && q.includes('SET "siteId"'));
            expect(sql).toBeDefined();
            expect(sql).toMatch(/SET "siteId" = spj\."id"/);
            expect(sql).toMatch(/"siteId" = skd\."id"/);
            expect(sql).toMatch(/skd\."code" = 'SKD' AND spj\."code" = 'SPJ'/);
        },
    );

    it('merges colliding workload counts, deletes their sources, then moves remaining rows', async () => {
        const queries = await run('up');
        const merge = queries.findIndex((q) => q.includes('"totalPoints" = target."totalPoints" + source."totalPoints"'));
        const remove = queries.findIndex((q) => q.includes('DELETE FROM "agent_daily_workload" source'));
        const move = queries.findIndex((q) => q.includes('UPDATE "agent_daily_workload" w SET "siteId"'));
        expect(merge).toBeGreaterThan(-1);
        expect(remove).toBeGreaterThan(merge);
        expect(move).toBeGreaterThan(remove);
    });

    it('moves e-form requests too (siteId is varchar there)', async () => {
        const sql = (await run('up')).find((q) => q.includes('UPDATE "eform_requests"'));
        expect(sql).toMatch(/SET "siteId" = spj\."id"::text/);
        expect(sql).toMatch(/"siteId" = skd\."id"::text/);
    });

    it('moves data after the handling site is set, so new and old requests agree', async () => {
        const queries = await run('up');
        const setHandled = queries.findIndex((q) => q.includes('SET "handledBySiteId"'));
        const moveTickets = queries.findIndex((q) => q.includes('UPDATE "tickets"'));
        expect(setHandled).toBeGreaterThan(0);
        expect(moveTickets).toBeGreaterThan(setHandled);
    });

    it('only drops the column on down; moved requests stay with Sepanjang', async () => {
        const queries = await run('down');
        expect(queries).toEqual([expect.stringMatching(/ALTER TABLE "sites" DROP COLUMN IF EXISTS "handledBySiteId"/)]);
    });
});
