import { MigrationInterface, QueryRunner } from 'typeorm';

/** CSI ICT: the service function (fungsi pelayanan) of each rated agent, kept on its subject profile. Additive only. */
export class CsiIctServiceFunction1794200000000 implements MigrationInterface {
    name = 'CsiIctServiceFunction1794200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_subject_profiles"
            ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "csi_subject_profiles" DROP COLUMN IF EXISTS "serviceFunction"');
    }
}
