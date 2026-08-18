import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteIdToEFormRequests1785000002000 implements MigrationInterface {
    name = 'AddSiteIdToEFormRequests1785000002000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "siteId" varchar`);
        // Backfill from requester's siteId where available
        await queryRunner.query(`
            UPDATE "eform_requests" r
            SET "siteId" = u."siteId"
            FROM "users" u
            WHERE r."requesterId" = u."id"
              AND r."siteId" IS NULL
              AND u."siteId" IS NOT NULL
        `);
        // Ensure index for per-site listing (idempotent; the 1779 migration will no-op if this ran first)
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_eform_request_site_created" ON "eform_requests" ("siteId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_eform_request_site_created"`);
        await queryRunner.query(`ALTER TABLE "eform_requests" DROP COLUMN IF EXISTS "siteId"`);
    }
}
