import { MigrationInterface, QueryRunner } from 'typeorm';

/** Human Capital administrator role (HC_ADMIN) and the HC subject membership flag of CSI. */
export class AddHcAdminRole1794120000000 implements MigrationInterface {
    name = 'AddHcAdminRole1794120000000';
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'HC_ADMIN'`);
        await queryRunner.query(`ALTER TABLE "csi_subject_profiles" ADD COLUMN IF NOT EXISTS "isMember" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL cannot drop an enum value; the role simply stays unused.
        await queryRunner.query(`ALTER TABLE "csi_subject_profiles" DROP COLUMN IF EXISTS "isMember"`);
    }
}
