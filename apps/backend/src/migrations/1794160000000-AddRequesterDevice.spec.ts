import { AddRequesterDevice1794160000000 } from './1794160000000-AddRequesterDevice';

describe('AddRequesterDevice migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new AddRequesterDevice1794160000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds nullable requester device columns and the heartbeat table', async () => {
        const sql = await run('up');
        expect(sql).toMatch(/"requesterIp" varchar\(45\) NULL/);
        expect(sql).toMatch(/"requesterHostname" varchar\(253\) NULL/);
        expect(sql).toMatch(/"requesterHostnameSource" varchar\(10\) NULL/);
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "user_devices"');
        expect(sql).toContain('UNIQUE ("userId", "hostname")');
        expect(sql).toContain('ON DELETE CASCADE');
    });

    it('down removes only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP TABLE IF EXISTS "user_devices"');
        expect(sql).toContain('DROP COLUMN IF EXISTS "requesterIp"');
        expect(sql).not.toContain('DROP TABLE IF EXISTS "tickets"');
    });
});
