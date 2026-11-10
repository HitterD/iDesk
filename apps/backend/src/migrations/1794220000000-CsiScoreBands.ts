import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive per-survey score colour bands; existing surveys get the legacy 4.0 / 4.5. */
export class CsiScoreBands1794220000000 implements MigrationInterface {
    name = 'CsiScoreBands1794220000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_periods"
            ADD COLUMN IF NOT EXISTS "scoreFairMin" numeric(2,1) NOT NULL DEFAULT 4.0,
            ADD COLUMN IF NOT EXISTS "scoreGoodMin" numeric(2,1) NOT NULL DEFAULT 4.5`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "scoreFairMin", DROP COLUMN IF EXISTS "scoreGoodMin"');
    }
}
