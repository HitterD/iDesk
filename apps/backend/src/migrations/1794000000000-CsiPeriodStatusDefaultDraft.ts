import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New CSI periods start as DRAFT at the database level too (fail closed): an insert that omits the
 * status no longer goes live. Existing rows keep their value; the PUBLISHED default only existed to
 * keep pre-existing periods visible when the column was added.
 */
export class CsiPeriodStatusDefaultDraft1794000000000 implements MigrationInterface {
    name = 'CsiPeriodStatusDefaultDraft1794000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_periods" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_periods" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'`);
    }
}
