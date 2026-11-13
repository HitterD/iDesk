import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { VISIBLE_NOTE_SQL } from './notification.service';

const maybeDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/**
 * Verifies VISIBLE_NOTE_SQL against real Postgres column types.
 * `notifications.userId` and `ticket_note_members.userId/noteId` are `uuid`, whereas
 * `notifications.referenceId` was migrated to `varchar`; casting only the right-hand
 * side raises SQLSTATE 42883 (`operator does not exist: text = uuid`).
 */
maybeDescribe('Notification VISIBLE_NOTE_SQL (integration, real Postgres)', () => {
    let ds: DataSource;

    beforeAll(async () => {
        ds = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL });
        await ds.initialize();
    });

    afterAll(async () => {
        await ds?.destroy();
    });

    it('filters TICKET_NOTE visibility without uuid/text operator mismatch', async () => {
        const runner = ds.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        try {
            await runner.query(`CREATE TEMP TABLE ticket_notes (id uuid PRIMARY KEY, "deletedAt" timestamptz) ON COMMIT DROP`);
            await runner.query(`CREATE TEMP TABLE ticket_note_members ("noteId" uuid NOT NULL, "userId" uuid NOT NULL) ON COMMIT DROP`);
            await runner.query(`CREATE TEMP TABLE notifications (id uuid PRIMARY KEY, "userId" uuid NOT NULL, type varchar NOT NULL, "referenceId" varchar) ON COMMIT DROP`);

            const userId = randomUUID();
            const otherUserId = randomUUID();
            const memberNoteId = randomUUID();
            const nonMemberNoteId = randomUUID();
            const deletedNoteId = randomUUID();

            const nRegularId = randomUUID();
            const nMemberNoteId = randomUUID();
            const nNonMemberNoteId = randomUUID();
            const nDeletedNoteId = randomUUID();

            await runner.query(`INSERT INTO ticket_notes (id, "deletedAt") VALUES ($1, NULL), ($2, NULL), ($3, now())`, [
                memberNoteId,
                nonMemberNoteId,
                deletedNoteId,
            ]);
            await runner.query(`INSERT INTO ticket_note_members ("noteId", "userId") VALUES ($1, $2), ($3, $4), ($5, $2)`, [
                memberNoteId,
                userId,
                nonMemberNoteId,
                otherUserId,
                deletedNoteId,
            ]);
            await runner.query(
                `INSERT INTO notifications (id, "userId", type, "referenceId") VALUES
                ($1, $2, 'TICKET_UPDATED', NULL),
                ($3, $2, 'TICKET_NOTE', $4),
                ($5, $2, 'TICKET_NOTE', $6),
                ($7, $2, 'TICKET_NOTE', $8)`,
                [nRegularId, userId, nMemberNoteId, memberNoteId, nNonMemberNoteId, nonMemberNoteId, nDeletedNoteId, deletedNoteId],
            );

            const rows: Array<{ id: string }> = await runner.query(
                `SELECT n.id FROM notifications n WHERE n."userId" = $1 AND ${VISIBLE_NOTE_SQL}`,
                [userId],
            );
            expect(rows.map((r) => r.id).sort()).toEqual([nMemberNoteId, nRegularId].sort());
        } finally {
            await runner.rollbackTransaction();
            await runner.release();
        }
    });
});
