import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1775230430429 implements MigrationInterface {
    name = 'Migration1775230430429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zoom_settings" ALTER COLUMN "slotStartTime" SET DEFAULT '08:00'`);
        await queryRunner.query(`ALTER TABLE "zoom_settings" ALTER COLUMN "slotEndTime" SET DEFAULT '18:00'`);
        await queryRunner.query(`ALTER TABLE "zoom_settings" ALTER COLUMN "workingDays" SET DEFAULT '[1,2,3,4,5]'`);
        await queryRunner.query(`ALTER TABLE "telegram_sessions" ALTER COLUMN "preferences" SET DEFAULT '{"notifyNewReply": true, "notifyStatusChange": true, "notifySlaWarning": true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "telegram_sessions" ALTER COLUMN "preferences" SET DEFAULT '{"notifyNewReply": true, "notifySlaWarning": true, "notifyStatusChange": true}'`);
        await queryRunner.query(`ALTER TABLE "zoom_settings" ALTER COLUMN "workingDays" SET DEFAULT '[1, 2, 3, 4, 5]'`);
        await queryRunner.query(`ALTER TABLE "zoom_settings" ALTER COLUMN "slotEndTime" SET DEFAULT '18:00:00'`);
        await queryRunner.query(`ALTER TABLE "zoom_settings" ALTER COLUMN "slotStartTime" SET DEFAULT '08:00:00'`);
    }

}
