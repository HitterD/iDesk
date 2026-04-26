import { MigrationInterface, QueryRunner } from 'typeorm';

export class LostItemFullWorkflow1777200000001 implements MigrationInterface {
    name = 'LostItemFullWorkflow1777200000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to lost_item_reports
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "photo_urls" text[] DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "qr_code_token" varchar UNIQUE`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" ADD COLUMN IF NOT EXISTS "qr_code_url" varchar`);

        // Add new enum values to lost_item_status
        await queryRunner.query(`ALTER TYPE "lost_item_status_enum" ADD VALUE IF NOT EXISTS 'CLAIMED'`);
        await queryRunner.query(`ALTER TYPE "lost_item_status_enum" ADD VALUE IF NOT EXISTS 'VERIFIED'`);
        await queryRunner.query(`ALTER TYPE "lost_item_status_enum" ADD VALUE IF NOT EXISTS 'RETURNED'`);

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
                "status" varchar NOT NULL DEFAULT 'PENDING',
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "lost_item_status_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "found_item_claims"`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "qr_code_url"`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "qr_code_token"`);
        await queryRunner.query(`ALTER TABLE "lost_item_reports" DROP COLUMN IF EXISTS "photo_urls"`);
    }
}
