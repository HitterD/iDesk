import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Original file name, size and type for chat attachments. A separate column
 * instead of reshaping `attachments`, so existing messages and every reader of
 * the path list (storage cleanup, image compression, Telegram) keep working.
 */
export class AddTicketMessageAttachmentInfo1792900000001 implements MigrationInterface {
    name = 'AddTicketMessageAttachmentInfo1792900000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "attachmentInfo" text NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages" DROP COLUMN IF EXISTS "attachmentInfo"`);
    }
}
