import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnreadChatFieldsToTicket1784678400000 implements MigrationInterface {
    name = 'AddUnreadChatFieldsToTicket1784678400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tickets"
            ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "lastMessageSenderRole" VARCHAR NULL,
            ADD COLUMN IF NOT EXISTS "userLastReadAt" TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS "agentLastReadAt" TIMESTAMP NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tickets"
            DROP COLUMN IF EXISTS "lastMessageAt",
            DROP COLUMN IF EXISTS "lastMessageSenderRole",
            DROP COLUMN IF EXISTS "userLastReadAt",
            DROP COLUMN IF EXISTS "agentLastReadAt"
        `);
    }
}
