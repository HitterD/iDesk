import { MigrationInterface, QueryRunner } from 'typeorm';

const QUESTION_COLUMNS = `ADD COLUMN IF NOT EXISTS "type" varchar(10) NOT NULL DEFAULT 'STAR',
        ADD COLUMN IF NOT EXISTS "required" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "options" jsonb NOT NULL DEFAULT '[]'::jsonb`;
const DROP_QUESTION_COLUMNS = `DROP COLUMN IF EXISTS "type", DROP COLUMN IF EXISTS "required", DROP COLUMN IF EXISTS "options"`;

/**
 * CSI revision 2: question bank (type/required/options, existing dimensions become STAR), team section
 * (TEAM ratee without user), multi-site periods (csi_period_sites replaces csi_periods.siteId) and SLA target.
 * Response columns are added by a later migration.
 */
const UP = [
    // Question bank + snapshot.
    `ALTER TABLE "csi_dimensions" ${QUESTION_COLUMNS}`,
    `ALTER TABLE "csi_dimensions" ALTER COLUMN "name" TYPE varchar(300)`,
    `ALTER TABLE "csi_period_ratee_dimensions" ${QUESTION_COLUMNS}`,
    `ALTER TABLE "csi_period_ratee_dimensions" ALTER COLUMN "dimensionName" TYPE varchar(300)`,
    // Period sections + SLA target.
    `ALTER TABLE "csi_periods" ADD COLUMN IF NOT EXISTS "teamEnabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "teamLabel" varchar(100) NOT NULL DEFAULT 'Tim IT Support',
        ADD COLUMN IF NOT EXISTS "individualEnabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "slaTargetPct" smallint NOT NULL DEFAULT 80`,
    // Multi-site: copy each period's single site before dropping the column.
    `CREATE TABLE IF NOT EXISTS "csi_period_sites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "periodId" uuid NOT NULL REFERENCES "csi_periods"("id") ON DELETE CASCADE,
        "siteId" uuid NOT NULL REFERENCES "sites"("id"),
        "createdAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_sites_period_site" ON "csi_period_sites" ("periodId", "siteId")`,
    `INSERT INTO "csi_period_sites" ("periodId", "siteId")
        SELECT "id", "siteId" FROM "csi_periods"
        ON CONFLICT ("periodId", "siteId") DO NOTHING`,
    `DROP INDEX IF EXISTS "IDX_csi_periods_scope_site_start"`,
    `ALTER TABLE "csi_periods" DROP COLUMN "siteId"`,
    `CREATE INDEX IF NOT EXISTS "IDX_csi_periods_scope_start" ON "csi_periods" ("scope", "startDate")`,
    // Team ratee: no user, at most one per period.
    `ALTER TABLE "csi_period_ratees" ADD COLUMN IF NOT EXISTS "kind" varchar(10) NOT NULL DEFAULT 'PERSON'`,
    `ALTER TABLE "csi_period_ratees" ALTER COLUMN "userId" DROP NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_team" ON "csi_period_ratees" ("periodId") WHERE "kind" = 'TEAM'`,
];

const DOWN = [
    `DROP INDEX IF EXISTS "UQ_csi_period_ratees_team"`,
    `DELETE FROM "csi_period_ratees" WHERE "kind" = 'TEAM'`,
    `ALTER TABLE "csi_period_ratees" ALTER COLUMN "userId" SET NOT NULL`,
    `ALTER TABLE "csi_period_ratees" DROP COLUMN IF EXISTS "kind"`,
    `DROP INDEX IF EXISTS "IDX_csi_periods_scope_start"`,
    `ALTER TABLE "csi_periods" ADD COLUMN "siteId" uuid NULL REFERENCES "sites"("id")`,
    `UPDATE "csi_periods" p SET "siteId" = (
        SELECT ps."siteId" FROM "csi_period_sites" ps WHERE ps."periodId" = p."id" ORDER BY ps."createdAt", ps."id" LIMIT 1
    )`,
    `ALTER TABLE "csi_periods" ALTER COLUMN "siteId" SET NOT NULL`,
    `CREATE INDEX IF NOT EXISTS "IDX_csi_periods_scope_site_start" ON "csi_periods" ("scope", "siteId", "startDate")`,
    `DROP TABLE IF EXISTS "csi_period_sites"`,
    `ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "teamEnabled", DROP COLUMN IF EXISTS "teamLabel",
        DROP COLUMN IF EXISTS "individualEnabled", DROP COLUMN IF EXISTS "slaTargetPct"`,
    `ALTER TABLE "csi_period_ratee_dimensions" ALTER COLUMN "dimensionName" TYPE varchar(100) USING left("dimensionName", 100)`,
    `ALTER TABLE "csi_period_ratee_dimensions" ${DROP_QUESTION_COLUMNS}`,
    `ALTER TABLE "csi_dimensions" ALTER COLUMN "name" TYPE varchar(100) USING left("name", 100)`,
    `ALTER TABLE "csi_dimensions" ${DROP_QUESTION_COLUMNS}`,
];

export class CsiRevision21794010000000 implements MigrationInterface {
    name = 'CsiRevision21794010000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const sql of UP) await queryRunner.query(sql);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const sql of DOWN) await queryRunner.query(sql);
    }
}
