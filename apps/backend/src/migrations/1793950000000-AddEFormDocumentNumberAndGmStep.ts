import { MigrationInterface, QueryRunner } from 'typeorm';

/** Form code per access type; must match EFORM_DOCUMENT_CODE in eform-document-number.ts. */
const CODE_SQL = `CASE "formType"
    WHEN 'VPN' THEN 'F/ICT/04'
    WHEN 'WEBSITE' THEN 'F/ICT/04-W'
    WHEN 'NETWORK' THEN 'F/ICT/04-N'
    WHEN 'FLASHDISK' THEN 'F/ICT/04-FD'
    WHEN 'EMAIL' THEN 'F/ICT/04-E'
    WHEN 'SYNOLOGY_NAS' THEN 'F/ICT/04-NAS'
    ELSE 'F/ICT/04' END`;

/**
 * E-form document numbers (a running number per form type instead of the bare form code) and the GM step: after the
 * manager approves, IT uploads the form signed by the GM before provisioning. Existing submitted requests are
 * numbered in submission order so the sequence continues from them.
 */
export class AddEFormDocumentNumberAndGmStep1793950000000 implements MigrationInterface {
    name = 'AddEFormDocumentNumberAndGmStep1793950000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "eform_requests_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_GM'`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "documentNumber" varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "gmApprovalFile" varchar NULL`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "gmApprovalFileName" varchar NULL`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "gmApprovalUploadedById" uuid NULL`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "gmApprovedAt" timestamp NULL`);
        await queryRunner.query(`
            UPDATE "eform_requests" e SET "documentNumber" = n.num
              FROM (SELECT id, ${CODE_SQL} || '/' || LPAD(ROW_NUMBER() OVER (
                        PARTITION BY "formType" ORDER BY COALESCE("submittedAt", "createdAt"), id)::text, 4, '0') AS num
                      FROM "eform_requests"
                     WHERE status::text NOT IN ('DRAFT', 'CANCELLED')) n
             WHERE e.id = n.id AND e."documentNumber" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_eform_requests_documentNumber" ON "eform_requests" ("documentNumber")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_eform_requests_documentNumber"`);
        // Requests waiting on the GM go back to IT, the step before this migration.
        await queryRunner.query(`UPDATE "eform_requests" SET status = 'PENDING_ICT' WHERE status = 'PENDING_GM'`);
        for (const column of ['gmApprovedAt', 'gmApprovalUploadedById', 'gmApprovalFileName', 'gmApprovalFile', 'documentNumber']) {
            await queryRunner.query(`ALTER TABLE "eform_requests" DROP COLUMN IF EXISTS "${column}"`);
        }
        // Postgres cannot drop an enum value; PENDING_GM stays (unused) after a rollback.
    }
}
