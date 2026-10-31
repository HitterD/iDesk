import { CreatePrivateTicketNotes1794050000000 } from './1794050000000-CreatePrivateTicketNotes';

describe('CreatePrivateTicketNotes migration', () => {
    it('creates private tables and constraints without altering public chat', async () => {
        const queries: string[] = [];
        await new CreatePrivateTicketNotes1794050000000().up({ query: async (sql: string) => queries.push(sql) } as any);
        const sql = queries.join('\n');
        expect(sql).toContain('CREATE TABLE "ticket_notes"');
        expect(sql).toContain('CREATE TABLE "ticket_note_deliveries"');
        expect(sql).toContain('REFERENCES "users"("id")');
        expect(sql).toContain('REFERENCES "tickets"("id")');
        expect(sql).toContain('UNIQUE ("noteId", "userId")');
        expect(sql).toContain('FOREIGN KEY ("id", "selectedSolutionMessageId")');
        expect(sql).toContain('ADD COLUMN "clientRequestId" uuid');
    });
    it('drops only feature-owned tables in reverse dependency order', async () => {
        const queries: string[] = [];
        await new CreatePrivateTicketNotes1794050000000().down({ query: async (sql: string) => queries.push(sql) } as any);
        expect(queries.join('\n')).toContain('DROP TABLE "ticket_notes"');
        expect(queries.join('\n')).not.toContain('DROP TABLE "tickets"');
    });
});
