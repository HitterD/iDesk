import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrivateTicketNotes1794050000000 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
        for (const name of ['notifications_type_enum', 'notification_type_enum']) {
            const rows = await queryRunner.query('SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1) AS "exists"', [name]);
            if (rows[0]?.exists) await queryRunner.query(`ALTER TYPE "${name}" ADD VALUE IF NOT EXISTS 'TICKET_NOTE'`);
        }
        await queryRunner.query(`ALTER TABLE "ticket_messages" ADD COLUMN "clientRequestId" uuid`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ticket_message_request" ON "ticket_messages" ("ticketId", "senderId", "clientRequestId") WHERE "clientRequestId" IS NOT NULL`);
        for (const sql of this.tables()) await queryRunner.query(sql);
        await queryRunner.query(`ALTER TABLE "ticket_notes" ADD CONSTRAINT "FK_note_solution"
            FOREIGN KEY ("id", "selectedSolutionMessageId") REFERENCES "ticket_note_messages"("noteId", "id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_note_active_session" ON "ticket_note_edit_sessions" ("noteId") WHERE "closedAt" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_note_member_viewer" ON "ticket_note_members" ("userId", "noteId")`);
        await queryRunner.query(`CREATE INDEX "IDX_note_ticket" ON "ticket_notes" ("ticketId", "deletedAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_note_delivery_pending" ON "ticket_note_deliveries" ("state", "createdAt")`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "ticket_notes" DROP CONSTRAINT "FK_note_solution"');
        for (const name of ['deliveries', 'attachments', 'revisions', 'edit_sessions', 'messages', 'members']) {
            await queryRunner.query(`DROP TABLE "ticket_note_${name}"`);
        }
        await queryRunner.query('DROP TABLE "ticket_notes"');
        await queryRunner.query('DROP INDEX "IDX_ticket_message_request"');
        await queryRunner.query('ALTER TABLE "ticket_messages" DROP COLUMN "clientRequestId"');
    }

    private tables(): string[] {
        return [
            `CREATE TABLE "ticket_notes" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "ticketId" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
                "createdById" uuid NOT NULL REFERENCES "users"("id"),
                "title" varchar(200) NOT NULL DEFAULT '',
                "document" jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}',
                "contentVersion" integer NOT NULL DEFAULT 0, "eventSequence" integer NOT NULL DEFAULT 0,
                "selectedSolutionMessageId" uuid, "selectedById" uuid REFERENCES "users"("id"),
                "selectedAt" timestamptz, "deletedAt" timestamptz,
                "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
            `CREATE TABLE "ticket_note_members" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "noteId" uuid NOT NULL REFERENCES "ticket_notes"("id") ON DELETE CASCADE,
                "userId" uuid NOT NULL REFERENCES "users"("id"),
                "addedById" uuid NOT NULL REFERENCES "users"("id"),
                "lastReadSequence" integer NOT NULL DEFAULT 0,
                "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("noteId", "userId"))`,
            `CREATE TABLE "ticket_note_messages" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "noteId" uuid NOT NULL REFERENCES "ticket_notes"("id") ON DELETE CASCADE,
                "authorId" uuid NOT NULL REFERENCES "users"("id"), "content" text NOT NULL,
                "sequence" integer NOT NULL, "mentionedUserIds" jsonb NOT NULL DEFAULT '[]',
                "attachmentIds" jsonb NOT NULL DEFAULT '[]', "clientRequestId" uuid NOT NULL,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                UNIQUE ("noteId", "sequence"), UNIQUE ("noteId", "id"), UNIQUE ("noteId", "authorId", "clientRequestId"))`,
            `CREATE TABLE "ticket_note_edit_sessions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "noteId" uuid NOT NULL REFERENCES "ticket_notes"("id") ON DELETE CASCADE,
                "userId" uuid NOT NULL REFERENCES "users"("id"), "leaseUntil" timestamptz NOT NULL,
                "baseVersion" integer NOT NULL, "finalVersion" integer,
                "closedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now())`,
            `CREATE TABLE "ticket_note_revisions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "noteId" uuid NOT NULL REFERENCES "ticket_notes"("id") ON DELETE CASCADE,
                "sessionId" uuid NOT NULL UNIQUE REFERENCES "ticket_note_edit_sessions"("id"),
                "actorId" uuid NOT NULL REFERENCES "users"("id"), "document" jsonb NOT NULL,
                "contentVersion" integer NOT NULL, "closedAt" timestamptz NOT NULL DEFAULT now())`,
            `CREATE TABLE "ticket_note_attachments" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "noteId" uuid NOT NULL REFERENCES "ticket_notes"("id") ON DELETE CASCADE,
                "uploaderId" uuid NOT NULL REFERENCES "users"("id"), "storageKey" text NOT NULL UNIQUE,
                "originalName" varchar(255) NOT NULL, "mime" varchar(100) NOT NULL, "size" integer NOT NULL,
                "createdAt" timestamptz NOT NULL DEFAULT now())`,
            `CREATE TABLE "ticket_note_deliveries" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "eventId" uuid NOT NULL, "noteId" uuid NOT NULL REFERENCES "ticket_notes"("id") ON DELETE CASCADE,
                "recipientId" uuid NOT NULL REFERENCES "users"("id"), "sequence" integer NOT NULL,
                "kind" varchar(30) NOT NULL, "notificationId" uuid,
                "state" varchar(20) NOT NULL DEFAULT 'PENDING', "attemptCount" integer NOT NULL DEFAULT 0, "claimedAt" timestamptz,
                "dedupKey" varchar(255) NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL DEFAULT now())`,
        ];
    }
}
