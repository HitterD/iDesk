import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ticket chat: stored emoji reactions (one per person per message) and the people a message mentions. */
export class TicketMessageReactionsMentions1794080000000 implements MigrationInterface {
    name = 'TicketMessageReactionsMentions1794080000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ticket_message_reactions" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "messageId" uuid NOT NULL REFERENCES "ticket_messages"("id") ON DELETE CASCADE,
            "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "emoji" varchar(16) NOT NULL,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_ticket_message_reactions_message_user" UNIQUE ("messageId", "userId")
        )`);
        await queryRunner.query(`CREATE INDEX "IDX_ticket_message_reactions_message" ON "ticket_message_reactions" ("messageId")`);
        await queryRunner.query(`ALTER TABLE "ticket_messages" ADD COLUMN "mentionedUserIds" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages" DROP COLUMN "mentionedUserIds"`);
        await queryRunner.query(`DROP TABLE "ticket_message_reactions"`);
    }
}
