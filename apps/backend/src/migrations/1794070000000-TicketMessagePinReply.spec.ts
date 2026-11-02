import { TicketMessagePinReply1794070000000 } from './1794070000000-TicketMessagePinReply';

describe('TicketMessagePinReply migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new TicketMessagePinReply1794070000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds pin columns, the reply link and a pinned index', async () => {
        const sql = await run('up');
        expect(sql).toContain('ADD COLUMN "pinnedAt" timestamp');
        expect(sql).toContain('ADD COLUMN "pinnedById" uuid');
        expect(sql).toContain('ADD COLUMN "replyToId" uuid REFERENCES "ticket_messages"');
        expect(sql).toContain('WHERE "pinnedAt" IS NOT NULL');
    });

    it('drops only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP INDEX "IDX_ticket_messages_pinned"');
        expect(sql).toContain('DROP COLUMN "replyToId"');
        expect(sql).not.toContain('DROP TABLE');
    });
});
