import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The booker's confirmation email goes out once per booking (and once per recurring series), and the
 * "starts in 15 minutes" reminder once per booking.
 */
export class ZoomBookingConfirmationSentAt1794330000000 implements MigrationInterface {
    name = 'ZoomBookingConfirmationSentAt1794330000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zoom_bookings" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP NULL`);
        // Existing bookings were confirmed already; a later retry must not email their bookers again.
        await queryRunner.query(`UPDATE "zoom_bookings" SET "confirmationSentAt" = "createdAt" WHERE "confirmationSentAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "zoom_bookings" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zoom_bookings" DROP COLUMN IF EXISTS "reminderSentAt"`);
        await queryRunner.query(`ALTER TABLE "zoom_bookings" DROP COLUMN IF EXISTS "confirmationSentAt"`);
    }
}
