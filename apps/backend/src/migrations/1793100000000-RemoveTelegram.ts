import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Telegram bot is retired: drop its session tables and per-user columns.
 * TicketSource/DeliveryChannel keep the TELEGRAM value for historic rows.
 * Irreversible by design — `down` only restores empty columns, not the data.
 */
export class RemoveTelegram1793100000000 implements MigrationInterface {
    name = 'RemoveTelegram1793100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "telegram_sessions" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "customer_sessions" CASCADE`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramChatId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "telegramNotifications"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "telegramEnabled"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "telegramChatId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "telegramChatId" character varying NULL`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "telegramEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramNotifications" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramChatId" bigint NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegramId" bigint NULL`);
    }
}
