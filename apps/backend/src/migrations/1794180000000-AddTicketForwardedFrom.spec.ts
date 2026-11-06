import { AddTicketForwardedFrom1794180000000 } from './1794180000000-AddTicketForwardedFrom';

describe('AddTicketForwardedFrom migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new AddTicketForwardedFrom1794180000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds nullable columns and backfills only the forward fields from the newest forward note', async () => {
        const sql = await run('up');
        expect(sql).toMatch(/"forwardedFromTeam" varchar\(20\) NULL/);
        expect(sql).toMatch(/"forwardedAt" timestamp NULL/);
        expect(sql).toMatch(/"forwardedById" uuid NULL/);
        expect(sql).toContain(`LIKE 'Ticket forwarded from %'`);
        expect(sql).toContain('ORDER BY m."ticketId", m."createdAt" DESC');
        expect(sql).toMatch(/SET "forwardedFromTeam" = f\.from_team, "forwardedAt" = f\.at\s/);
        expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM/);
    });

    it('down removes only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP COLUMN IF EXISTS "forwardedFromTeam"');
        expect(sql).not.toContain('DROP TABLE');
    });
});
