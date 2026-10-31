import { DataSource } from 'typeorm';
import { CreatePrivateTicketNotes1794050000000 } from '../../../migrations/1794050000000-CreatePrivateTicketNotes';
import { randomUUID } from 'crypto';

const url = process.env.TEST_DATABASE_URL;
const describeDatabase = url ? describe : describe.skip;

describeDatabase('private note PostgreSQL constraints and leases', () => {
    let source: DataSource;
    const actor = randomUUID();
    const ticket = randomUUID();
    const note = randomUUID();
    beforeAll(async () => {
        source = new DataSource({ type: 'postgres', url, entities: [], synchronize: false });
        await source.initialize();
        await source.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await source.query('CREATE TABLE users (id uuid PRIMARY KEY)');
        await source.query('CREATE TABLE tickets (id uuid PRIMARY KEY)');
        await source.query('CREATE TABLE ticket_messages (id uuid PRIMARY KEY, "ticketId" uuid, "senderId" varchar)');
        await source.query(`CREATE TYPE notifications_type_enum AS ENUM ('SYSTEM')`);
        const runner = source.createQueryRunner();
        await new CreatePrivateTicketNotes1794050000000().up(runner);
        await runner.release();
        await source.query('INSERT INTO users(id) VALUES ($1)', [actor]);
        await source.query('INSERT INTO tickets(id) VALUES ($1)', [ticket]);
        await source.query('INSERT INTO ticket_notes(id,"ticketId","createdById") VALUES ($1,$2,$3)', [note, ticket, actor]);
    });
    afterAll(async () => {
        if (!source?.isInitialized) return;
        const runner = source.createQueryRunner();
        await new CreatePrivateTicketNotes1794050000000().down(runner);
        await runner.release();
        await source.query('DROP TABLE ticket_messages, tickets, users');
        await source.query('DROP TYPE notifications_type_enum');
        await source.destroy();
    });
    it('serializes competing editing acquisitions on the note row', async () => {
        const acquire = async () => source.transaction(async manager => {
            await manager.query('SELECT id FROM ticket_notes WHERE id=$1 FOR UPDATE', [note]);
            const active = await manager.query('SELECT id FROM ticket_note_edit_sessions WHERE "noteId"=$1 AND "closedAt" IS NULL', [note]);
            if (active.length) return false;
            await manager.query('INSERT INTO ticket_note_edit_sessions("noteId","userId","leaseUntil","baseVersion") VALUES ($1,$2,now()+interval \'60 seconds\',0)', [note, actor]);
            return true;
        });
        expect((await Promise.all([acquire(), acquire()])).sort()).toEqual([false, true]);
    });
    it('rejects a selected solution belonging to another note', async () => {
        const other = randomUUID();
        const message = randomUUID();
        await source.query('INSERT INTO ticket_notes(id,"ticketId","createdById") VALUES ($1,$2,$3)', [other, ticket, actor]);
        await source.query('INSERT INTO ticket_note_messages(id,"noteId","authorId",content,sequence,"clientRequestId") VALUES ($1,$2,$3,\'private\',1,$4)', [message, other, actor, randomUUID()]);
        await expect(source.query('UPDATE ticket_notes SET "selectedSolutionMessageId"=$1 WHERE id=$2', [message, note]))
            .rejects.toMatchObject({ code: '23503' });
    });
    it('claims an outbox delivery only once across competing workers', async () => {
        await source.query(`INSERT INTO ticket_note_deliveries("eventId","noteId","recipientId",sequence,kind,"dedupKey") VALUES ($1,$2,$3,1,'MESSAGE','one')`, [randomUUID(), note, actor]);
        const claim = () => source.transaction(manager => manager.query(`WITH pending AS (
            SELECT id FROM ticket_note_deliveries WHERE state='PENDING' LIMIT 1 FOR UPDATE SKIP LOCKED
        ) UPDATE ticket_note_deliveries d SET state='PROCESSING', "claimedAt"=now() FROM pending WHERE d.id=pending.id RETURNING d.id`));
        const results = await Promise.all([claim(), claim()]);
        expect(results.flatMap(result => result[0])).toHaveLength(1);
    });
    it('worker flush delivers claimed rows instead of saving the driver result tuple', async () => {
        const { TicketNoteNotificationService } = await import('./ticket-note-notification.service');
        await source.query(`INSERT INTO ticket_note_deliveries("eventId","noteId","recipientId",sequence,kind,"dedupKey") VALUES ($1,$2,$3,2,'MESSAGE','two')`, [randomUUID(), note, actor]);
        const delivered: string[] = [];
        const service = new TicketNoteNotificationService(source, {} as any, {} as any);
        service.deliver = async (row: any) => { delivered.push(row.dedupKey); };
        await service.flush();
        expect(delivered).toEqual(['two']);
    });
});
