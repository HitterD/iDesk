import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CSI ICT:
 * - the service function (fungsi pelayanan) of each rated agent, kept on its subject profile;
 * - `selfResults` per survey: rated people may see their own anonymous results. Every existing survey gets false
 *   (it was answered without that promise); surveys created from now on get true. A flag, not a date, so the
 *   database and server timezones never decide which surveys are shown.
 * Additive only.
 */
export class CsiIctServiceFunction1794200000000 implements MigrationInterface {
    name = 'CsiIctServiceFunction1794200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_subject_profiles"
            ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL`);
        await queryRunner.query(`ALTER TABLE "csi_periods"
            ADD COLUMN IF NOT EXISTS "selfResults" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "selfResults"');
        await queryRunner.query('ALTER TABLE "csi_subject_profiles" DROP COLUMN IF EXISTS "serviceFunction"');
    }
}
