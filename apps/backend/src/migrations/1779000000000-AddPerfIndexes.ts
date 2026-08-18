import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerfIndexes1779000000000 implements MigrationInterface {
    name = 'AddPerfIndexes1779000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Notifications: dedup hot path (userId, type, referenceId, createdAt)
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_notif_dedup" ON "notifications" ("userId", "type", "referenceId", "createdAt")`,
        );
        // Found item claims: status + finder/report lookups
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_found_claim_status" ON "found_item_claims" ("status", "finderId", "lostItemReportId")`,
        );
        // Knowledge-base: published articles by category
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_kb_article_published" ON "articles" ("status", "categoryId", "publishedAt")`,
        );
        // E-form: per-site recent list (column may not exist yet if AddSiteId migration has not run)
        await queryRunner.query(`
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eform_requests' AND column_name='siteId') THEN
                    CREATE INDEX IF NOT EXISTS "idx_eform_request_site_created" ON "eform_requests" ("siteId", "createdAt");
                END IF;
            END $$`);
        // Zoom-booking: overlap check by technician + window
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_zoom_booking_overlap" ON "zoom_bookings" ("accountId", "startAt", "endAt", "status")`,
        );
        // pg_trgm GIN on user search columns (ILIKE '%x%')
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_user_fullname_trgm" ON "users" USING gin ("fullName" gin_trgm_ops)`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_user_email_trgm" ON "users" USING gin ("email" gin_trgm_ops)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_notif_dedup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_found_claim_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_kb_article_published"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_eform_request_site_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_zoom_booking_overlap"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_fullname_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_email_trgm"`);
    }
}
