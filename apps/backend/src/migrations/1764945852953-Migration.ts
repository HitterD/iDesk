import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1764945852953 implements MigrationInterface {
    name = 'Migration1764945852953'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add version column with default value for optimistic locking
        // Using ADD COLUMN IF NOT EXISTS equivalent for PostgreSQL
        const hasColumn = await queryRunner.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tickets' AND column_name = 'version'
            );
        `);

        if (!hasColumn[0].exists) {
            await queryRunner.query(`ALTER TABLE "tickets" ADD "version" integer NOT NULL DEFAULT 1`);
        } else {
            // Update any null values if column exists
            await queryRunner.query(`UPDATE "tickets" SET "version" = 1 WHERE "version" IS NULL`);
        }

        await queryRunner.query(`ALTER TABLE "telegram_sessions" ALTER COLUMN "preferences" SET DEFAULT '{"notifyNewReply": true, "notifyStatusChange": true, "notifySlaWarning": true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "telegram_sessions" ALTER COLUMN "preferences" SET DEFAULT '{"notifyNewReply": true, "notifySlaWarning": true, "notifyStatusChange": true}'`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "version"`);
    }

}
