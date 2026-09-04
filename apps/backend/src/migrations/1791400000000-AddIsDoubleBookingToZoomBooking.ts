import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDoubleBookingToZoomBooking1791400000000 implements MigrationInterface {
    name = 'AddIsDoubleBookingToZoomBooking1791400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "zoom_bookings" ADD COLUMN IF NOT EXISTS "isDoubleBooking" boolean NOT NULL DEFAULT false`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "zoom_bookings" DROP COLUMN IF EXISTS "isDoubleBooking"`
        );
    }
}
