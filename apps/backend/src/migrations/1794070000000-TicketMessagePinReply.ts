import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ticket chat: up to three pinned messages per ticket, and replies linked to the message they quote. */
export class TicketMessagePinReply1794070000000 implements MigrationInterface {
    name = 'TicketMessagePinReply1794070000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages"
            ADD COLUMN "pinnedAt" timestamp,
            ADD COLUMN "pinnedById" uuid REFERENCES "users"("id") ON DELETE SET NULL,
            ADD COLUMN "replyToId" uuid REFERENCES "ticket_messages"("id") ON DELETE SET NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_messages_pinned" ON "ticket_messages" ("ticketId") WHERE "pinnedAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_ticket_messages_pinned"`);
        await queryRunner.query(`ALTER TABLE "ticket_messages"
            DROP COLUMN "replyToId",
            DROP COLUMN "pinnedById",
            DROP COLUMN "pinnedAt"`);
    }
}
