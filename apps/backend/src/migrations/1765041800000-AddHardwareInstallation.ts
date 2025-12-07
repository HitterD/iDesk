import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHardwareInstallation1765041800000 implements MigrationInterface {
    name = 'AddHardwareInstallation1765041800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add hardware installation columns to tickets table
        await queryRunner.query(`ALTER TABLE "tickets" ADD "isHardwareInstallation" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "scheduledDate" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "scheduledTime" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "hardwareType" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "reminderD1Sent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "reminderD0Sent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "userAcknowledged" boolean NOT NULL DEFAULT false`);

        // Add new enum values to notification_type
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'HARDWARE_INSTALL_D1'`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'HARDWARE_INSTALL_D0'`);

        // Add new enum value to notification_category
        await queryRunner.query(`ALTER TYPE "public"."notifications_category_enum" ADD VALUE IF NOT EXISTS 'CATEGORY_HARDWARE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove columns from tickets table
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "userAcknowledged"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "reminderD0Sent"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "reminderD1Sent"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "hardwareType"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "scheduledTime"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "scheduledDate"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "isHardwareInstallation"`);

        // Note: PostgreSQL does not support removing enum values easily
        // The enum values will remain but won't cause issues
    }
}
