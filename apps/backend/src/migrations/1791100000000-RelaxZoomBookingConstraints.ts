import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelaxZoomBookingConstraints1791100000000 implements MigrationInterface {
    name = 'RelaxZoomBookingConstraints1791100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop unique constraint on (zoomAccountId, bookingDate, startTime) to allow overlapping Zoom meetings
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_655d04a46229413ec0a06431f2"`);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_zoom_bookings_acc_date_time" ON "zoom_bookings" ("zoomAccountId", "bookingDate", "startTime")`
        );

        // Drop unique constraint on externalZoomMeetingId and widen to varchar(255) for occurrence keys
        await queryRunner.query(`ALTER TABLE "zoom_bookings" DROP CONSTRAINT IF EXISTS "UQ_877f02deb83ab1ed31a99d779ab"`);
        await queryRunner.query(`ALTER TABLE "zoom_bookings" ALTER COLUMN "externalZoomMeetingId" TYPE varchar(255)`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_zoom_bookings_external_key" ON "zoom_bookings" ("externalZoomMeetingId") WHERE "externalZoomMeetingId" IS NOT NULL`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zoom_bookings_external_key"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_zoom_bookings_acc_date_time"`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_655d04a46229413ec0a06431f2" ON "zoom_bookings" ("zoomAccountId", "bookingDate", "startTime")`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_bookings" ADD CONSTRAINT "UQ_877f02deb83ab1ed31a99d779ab" UNIQUE ("externalZoomMeetingId")`
        );
    }
}
