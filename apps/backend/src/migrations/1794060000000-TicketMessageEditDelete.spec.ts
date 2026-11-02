import { TicketMessageEditDelete1794060000000 } from './1794060000000-TicketMessageEditDelete';

describe('TicketMessageEditDelete migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new TicketMessageEditDelete1794060000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds edit/delete columns and the edit audit table', async () => {
        const sql = await run('up');
        expect(sql).toContain('ADD COLUMN "editedAt" timestamp');
        expect(sql).toContain('ADD COLUMN "deletedAt" timestamp');
        expect(sql).toContain('ADD COLUMN "deletedById" uuid');
        expect(sql).toContain('CREATE TABLE "ticket_message_edits"');
        expect(sql).toContain('ON DELETE CASCADE');
    });

    it('drops only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP TABLE "ticket_message_edits"');
        expect(sql).toContain('DROP COLUMN "deletedById"');
        expect(sql).not.toContain('DROP TABLE "ticket_messages"');
    });
});
