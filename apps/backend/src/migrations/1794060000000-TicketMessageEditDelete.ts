import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ticket chat: senders edit (15 min) and delete their messages; deletes are soft, edits keep the old text. */
export class TicketMessageEditDelete1794060000000 implements MigrationInterface {
    name = 'TicketMessageEditDelete1794060000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages"
            ADD COLUMN "editedAt" timestamp,
            ADD COLUMN "deletedAt" timestamp,
            ADD COLUMN "deletedById" uuid REFERENCES "users"("id") ON DELETE SET NULL`);
        await queryRunner.query(`CREATE TABLE "ticket_message_edits" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "messageId" uuid NOT NULL REFERENCES "ticket_messages"("id") ON DELETE CASCADE,
            "previousContent" text NOT NULL,
            "editedById" uuid REFERENCES "users"("id") ON DELETE SET NULL,
            "editedAt" timestamp NOT NULL DEFAULT now()
        )`);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_message_edits_message" ON "ticket_message_edits" ("messageId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ticket_message_edits"`);
        await queryRunner.query(`ALTER TABLE "ticket_messages"
            DROP COLUMN "deletedById",
            DROP COLUMN "deletedAt",
            DROP COLUMN "editedAt"`);
    }
}
