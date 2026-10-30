import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOccurrenceIdToZoomMeetings1792100000000 implements MigrationInterface {
    name = 'AddOccurrenceIdToZoomMeetings1792100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zoom_meetings" ADD COLUMN IF NOT EXISTS "occurrenceId" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "zoom_meetings" DROP COLUMN IF EXISTS "occurrenceId"`);
    }
}
