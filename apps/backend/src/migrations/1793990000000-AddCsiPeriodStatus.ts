import { MigrationInterface, QueryRunner } from 'typeorm';

/** Draft/published flag for CSI periods; periods that existed before stay visible (PUBLISHED). */
export class AddCsiPeriodStatus1793990000000 implements MigrationInterface {
    name = 'AddCsiPeriodStatus1793990000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_periods" ADD COLUMN IF NOT EXISTS "status" varchar(10) NOT NULL DEFAULT 'PUBLISHED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "status"`);
    }
}
