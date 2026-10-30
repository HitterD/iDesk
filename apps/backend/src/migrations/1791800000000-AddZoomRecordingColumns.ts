import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZoomRecordingColumns1791800000000 implements MigrationInterface {
    name = 'AddZoomRecordingColumns1791800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" ADD COLUMN IF NOT EXISTS "recordingUrl" text`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" ADD COLUMN IF NOT EXISTS "recordingPasscode" character varying(50)`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" ADD COLUMN IF NOT EXISTS "recordingDuration" integer`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" ADD COLUMN IF NOT EXISTS "recordingFiles" jsonb`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" ADD COLUMN IF NOT EXISTS "recordedAt" TIMESTAMP`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" DROP COLUMN IF EXISTS "recordedAt"`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" DROP COLUMN IF EXISTS "recordingFiles"`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" DROP COLUMN IF EXISTS "recordingDuration"`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" DROP COLUMN IF EXISTS "recordingPasscode"`
        );
        await queryRunner.query(
            `ALTER TABLE "zoom_meetings" DROP COLUMN IF EXISTS "recordingUrl"`
        );
    }
}
