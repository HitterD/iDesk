import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CSI periods: admin cancellation (status CANCELLED + who/when/why, answers kept) and an explicit
 * "who rates whom" mode so an "everyone rates everyone" choice is never overwritten by the scope template.
 * Existing periods with pairs become CUSTOM, the rest stay unset (template may still apply until chosen).
 */
export class CsiPeriodCancelAndPairMode1794130000000 implements MigrationInterface {
    name = 'CsiPeriodCancelAndPairMode1794130000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_periods"
            ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz NULL,
            ADD COLUMN IF NOT EXISTS "cancelledById" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS "cancelReason" varchar(500) NULL,
            ADD COLUMN IF NOT EXISTS "pairMode" varchar(10) NULL`);
        await queryRunner.query(`UPDATE "csi_periods" p SET "pairMode" = 'CUSTOM'
            WHERE "pairMode" IS NULL AND EXISTS (SELECT 1 FROM "csi_period_rater_ratees" r WHERE r."periodId" = p."id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "csi_periods" SET "status" = 'DRAFT' WHERE "status" = 'CANCELLED'`);
        await queryRunner.query(`ALTER TABLE "csi_periods"
            DROP COLUMN IF EXISTS "pairMode",
            DROP COLUMN IF EXISTS "cancelReason",
            DROP COLUMN IF EXISTS "cancelledById",
            DROP COLUMN IF EXISTS "cancelledAt"`);
    }
}
