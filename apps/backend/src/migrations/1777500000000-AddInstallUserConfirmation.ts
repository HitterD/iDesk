import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstallUserConfirmation1777500000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TYPE "hardware_requests_status_enum" ADD VALUE IF NOT EXISTS 'AWAITING_USER_CONFIRMATION'`,
        );
        await qr.query(
            `ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "install_marked_done_at" TIMESTAMPTZ NULL`,
        );
        await qr.query(
            `ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "user_confirmed_at" TIMESTAMPTZ NULL`,
        );
        await qr.query(
            `ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "user_confirmation_kind" VARCHAR(16) NULL`,
        );
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TABLE "hardware_requests" DROP COLUMN IF EXISTS "user_confirmation_kind"`,
        );
        await qr.query(
            `ALTER TABLE "hardware_requests" DROP COLUMN IF EXISTS "user_confirmed_at"`,
        );
        await qr.query(
            `ALTER TABLE "hardware_requests" DROP COLUMN IF EXISTS "install_marked_done_at"`,
        );
        // NOTE: PostgreSQL does not support removing enum values; down cannot fully revert.
    }
}
