import { TicketMessageReactionsMentions1794080000000 } from './1794080000000-TicketMessageReactionsMentions';

describe('TicketMessageReactionsMentions migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new TicketMessageReactionsMentions1794080000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds the reactions table (one per person per message) and the mention list', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE "ticket_message_reactions"');
        expect(sql).toContain('UNIQUE ("messageId", "userId")');
        expect(sql).toContain('ON DELETE CASCADE');
        expect(sql).toContain(`ADD COLUMN "mentionedUserIds" jsonb NOT NULL DEFAULT '[]'`);
    });

    it('drops only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP TABLE "ticket_message_reactions"');
        expect(sql).toContain('DROP COLUMN "mentionedUserIds"');
        expect(sql).not.toContain('DROP TABLE "ticket_messages"');
    });
});
