import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CSI HC: the service function (fungsi pelayanan) of each PIC, snapshotted on period ratees. Additive only.
 */
export class CsiServiceFunctionAndTemplates1794190000000 implements MigrationInterface {
    name = 'CsiServiceFunctionAndTemplates1794190000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_pics"
            ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees"
            ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_period_ratees" DROP COLUMN IF EXISTS "serviceFunction"`);
        await queryRunner.query(`ALTER TABLE "csi_pics" DROP COLUMN IF EXISTS "serviceFunction"`);
    }
}
