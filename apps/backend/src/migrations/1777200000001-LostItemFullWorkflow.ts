import { MigrationInterface, QueryRunner } from 'typeorm';

export class LostItemFullWorkflow1777200000001 implements MigrationInterface {
    name = 'LostItemFullWorkflow1777200000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to lost_item_reports
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "photo_urls" text[] DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "qr_code_token" varchar`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "qr_code_url" varchar`);

        // Add new enum values to lost_item_status
        await queryRunner.query(`ALTER TYPE "lost_item_reports_status_enum" ADD VALUE IF NOT EXISTS 'CLAIMED'`);
        await queryRunner.query(`ALTER TYPE "lost_item_reports_status_enum" ADD VALUE IF NOT EXISTS 'VERIFIED'`);
        await queryRunner.query(`ALTER TYPE "lost_item_reports_status_enum" ADD VALUE IF NOT EXISTS 'RETURNED'`);

        // Create found_item_claims table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "found_item_claims" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "finder_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                "lost_item_report_id" uuid REFERENCES "lost_item_reports"("id") ON DELETE SET NULL,
                "location_found" text NOT NULL,
                "found_at" timestamp NOT NULL,
                "description" text NOT NULL,
                "photo_urls" text[] DEFAULT '{}',
                "status" varchar NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'MATCHED', 'REJECTED', 'RETURNED')),
                "manager_notes" text,
                "matched_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
                "matched_at" timestamp,
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        // Create lost_item_status_logs table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "lost_item_status_logs" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "lost_item_report_id" uuid NOT NULL REFERENCES "lost_item_reports"("id") ON DELETE CASCADE,
                "from_status" varchar,
                "to_status" varchar NOT NULL,
                "changed_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
                "notes" text,
                "timestamp" timestamp NOT NULL DEFAULT now()
            )
        `);

        // Named unique index for qr_code_token (avoids anonymous constraint, easier to drop in down())
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_lost_item_reports_qr_code_token" ON "lost_item_reports"("qr_code_token")`);

        // FK indexes for found_item_claims
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_found_item_claims_finder_id" ON "found_item_claims"("finder_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_found_item_claims_report_id" ON "found_item_claims"("lost_item_report_id")`);

        // FK index for lost_item_status_logs
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lost_item_status_logs_report_id" ON "lost_item_status_logs"("lost_item_report_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // NOTE: PostgreSQL does not support DROP VALUE on enums.
        // Values 'CLAIMED', 'VERIFIED', 'RETURNED' added to lost_item_status_enum
        // cannot be removed without recreating the type. Manual intervention required.
        throw new Error(
            'Enum rollback not supported: CLAIMED/VERIFIED/RETURNED cannot be removed from lost_item_status_enum. Manual type recreation required.'
        );
        // Unreachable — kept for documentation:
        // await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lost_item_status_logs_report_id"`);
        // await queryRunner.query(`DROP INDEX IF EXISTS "IDX_found_item_claims_report_id"`);
        // await queryRunner.query(`DROP INDEX IF EXISTS "IDX_found_item_claims_finder_id"`);
        // await queryRunner.query(`DROP INDEX IF EXISTS "UQ_lost_item_reports_qr_code_token"`);
        // await queryRunner.query(`DROP TABLE IF EXISTS "lost_item_status_logs"`);
        // await queryRunner.query(`DROP TABLE IF EXISTS "found_item_claims"`);
        // await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "qr_code_url"`);
        // await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "qr_code_token"`);
        // await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "photo_urls"`);
    }
}
