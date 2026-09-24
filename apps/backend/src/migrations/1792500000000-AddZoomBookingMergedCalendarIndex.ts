import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZoomBookingMergedCalendarIndex1792500000000 implements MigrationInterface {
    name = 'AddZoomBookingMergedCalendarIndex1792500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_zoom_bookings_date_status_start" ON "zoom_bookings" ("bookingDate", "status", "startTime");`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_zoom_bookings_date_status_start";`
        );
    }
}
