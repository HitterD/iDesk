import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The GM step becomes a choice: on by default for VPN, switchable by ICT, with an optional GM who approves in iDesk.
 * Requests already in or past the GM step keep it, so nothing in flight changes course.
 */
export class AddEFormGmChoice1794090000000 implements MigrationInterface {
    name = 'AddEFormGmChoice1794090000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "requiresGm" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "gmApproverId" uuid NULL`);
        await queryRunner.query(`
            UPDATE "eform_requests" SET "requiresGm" = true
             WHERE "formType" = 'VPN' OR status = 'PENDING_GM' OR "gmApprovedAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "eform_requests" DROP COLUMN IF EXISTS "gmApproverId"`);
        await queryRunner.query(`ALTER TABLE "eform_requests" DROP COLUMN IF EXISTS "requiresGm"`);
    }
}
