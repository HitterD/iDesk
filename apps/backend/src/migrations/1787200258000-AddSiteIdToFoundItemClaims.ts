import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteIdToFoundItemClaims1787200258000 implements MigrationInterface {
    name = 'AddSiteIdToFoundItemClaims1787200258000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add siteId column (camelCase to match TypeORM default + recent eform precedent)
        await queryRunner.query(`ALTER TABLE "found_item_claims" ADD COLUMN IF NOT EXISTS "siteId" varchar`);

        // Phase 1 backfill: via linked lost_item_report -> ticket.siteId
        // Note: lost_item_reports uses "ticketId" (per @JoinColumn), tickets uses "siteId"
        await queryRunner.query(`
            UPDATE "found_item_claims" fc
            SET "siteId" = t."siteId"
            FROM "lost_item_reports" r
            JOIN "tickets" t ON r."ticketId" = t."id"
            WHERE fc."lost_item_report_id" = r."id"
              AND fc."siteId" IS NULL
              AND t."siteId" IS NOT NULL
        `);

        // Phase 2 backfill (fallback): use finder's user.siteId for unlinked or still-null claims
        await queryRunner.query(`
            UPDATE "found_item_claims" fc
            SET "siteId" = u."siteId"
            FROM "users" u
            WHERE fc."finder_id" = u."id"
              AND fc."siteId" IS NULL
              AND u."siteId" IS NOT NULL
        `);

        // Index to support per-site listing ordered by createdAt (idempotent)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_found_item_claims_site_created" ON "found_item_claims" ("siteId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_found_item_claims_site_created"`);
        await queryRunner.query(`ALTER TABLE "found_item_claims" DROP COLUMN IF EXISTS "siteId"`);
    }
}
