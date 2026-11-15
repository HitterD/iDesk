import { AddTicketForwardedFromSite1794700000000 } from './1794700000000-AddTicketForwardedFromSite';

describe('AddTicketForwardedFromSite migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new AddTicketForwardedFromSite1794700000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds nullable forwardedFromSiteId column referencing sites without dropping data', async () => {
        const sql = await run('up');
        expect(sql).toMatch(/"forwardedFromSiteId" uuid NULL REFERENCES "sites"\("id"\) ON DELETE SET NULL/);
        expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM/);
    });

    it('down drops only forwardedFromSiteId', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP COLUMN IF EXISTS "forwardedFromSiteId"');
        expect(sql).not.toContain('DROP TABLE');
    });
});
