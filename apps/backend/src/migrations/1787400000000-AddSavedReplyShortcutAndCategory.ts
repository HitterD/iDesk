import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedReplyShortcutAndCategory1787400000000 implements MigrationInterface {
    name = 'AddSavedReplyShortcutAndCategory1787400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "saved_replies" ADD COLUMN IF NOT EXISTS "shortcut" VARCHAR`);
        await queryRunner.query(`ALTER TABLE "saved_replies" ADD COLUMN IF NOT EXISTS "category" VARCHAR DEFAULT 'General'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_saved_replies_user_id" ON "saved_replies" ("userId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_saved_replies_user_id"`);
        await queryRunner.query(`ALTER TABLE "saved_replies" DROP COLUMN IF EXISTS "category"`);
        await queryRunner.query(`ALTER TABLE "saved_replies" DROP COLUMN IF EXISTS "shortcut"`);
    }
}
