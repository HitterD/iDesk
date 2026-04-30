import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddActionItemSnooze1777400000000 implements MigrationInterface {
    name = 'AddActionItemSnooze1777400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "action_item_snooze" (
                "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id"       VARCHAR     NOT NULL,
                "entity_type"   VARCHAR     NOT NULL,
                "entity_id"     VARCHAR     NOT NULL,
                "snoozed_until" TIMESTAMP   NOT NULL,
                "created_at"    TIMESTAMP   DEFAULT NOW(),
                CONSTRAINT "uq_snooze_user_entity" UNIQUE ("user_id", "entity_type", "entity_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_snooze_user_expiry"
            ON "action_item_snooze" ("user_id", "snoozed_until")
        `);
        await queryRunner.query(`
            ALTER TABLE "notification_preferences"
            ADD COLUMN IF NOT EXISTS "categorySettings" jsonb DEFAULT '{}'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_snooze_user_expiry"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "action_item_snooze"`);
        await queryRunner.query(`
            ALTER TABLE "notification_preferences"
            DROP COLUMN IF EXISTS "categorySettings"
        `);
    }
}
