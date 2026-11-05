import { AddUserTicketTemplates1794150000000 } from './1794150000000-AddUserTicketTemplates';

describe('AddUserTicketTemplates migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new AddUserTicketTemplates1794150000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('creates the per-user template table, removed with its owner', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "user_ticket_templates"');
        expect(sql).toContain('REFERENCES "users"("id") ON DELETE CASCADE');
        expect(sql).toContain('ON "user_ticket_templates" ("userId", "ticketType")');
    });

    it('drops only its own table', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP TABLE IF EXISTS "user_ticket_templates"');
        expect(sql).not.toContain('"users"');
    });
});
