import { QueryRunner } from 'typeorm';
import { CsiRevision21794010000000 } from './1794010000000-CsiRevision2';

describe('CsiRevision21794010000000', () => {
    const migration = new CsiRevision21794010000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = {
            query: jest.fn(async (sql: string) => { statements.push(sql); }),
        } as unknown as QueryRunner;
    });

    const indexOf = (pattern: RegExp) => {
        const index = statements.findIndex((sql) => pattern.test(sql));
        expect(index).toBeGreaterThanOrEqual(0);
        return index;
    };

    it('migration backfills period sites and STAR type', async () => {
        await migration.up(queryRunner);
        const createSites = indexOf(/CREATE TABLE IF NOT EXISTS "csi_period_sites"/);
        const backfill = indexOf(/INSERT INTO "csi_period_sites" \("periodId", "siteId"\)\s+SELECT "id", "siteId" FROM "csi_periods"/);
        const dropOldIndex = indexOf(/DROP INDEX IF EXISTS "IDX_csi_periods_scope_site_start"/);
        const dropSiteId = indexOf(/ALTER TABLE "csi_periods" DROP COLUMN "siteId"/);
        expect(createSites).toBeLessThan(backfill);
        expect(backfill).toBeLessThan(dropOldIndex);
        expect(backfill).toBeLessThan(dropSiteId);
        expect(indexOf(/CREATE INDEX IF NOT EXISTS "IDX_csi_periods_scope_start" ON "csi_periods" \("scope", "startDate"\)/)).toBeGreaterThan(dropSiteId);

        // Existing dimensions and snapshots become STAR questions, required, without options.
        for (const table of ['csi_dimensions', 'csi_period_ratee_dimensions']) {
            const sql = statements[indexOf(new RegExp(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "type"`))];
            expect(sql).toContain(`"type" varchar(10) NOT NULL DEFAULT 'STAR'`);
            expect(sql).toContain(`"required" boolean NOT NULL DEFAULT true`);
            expect(sql).toContain(`"options" jsonb NOT NULL DEFAULT '[]'::jsonb`);
        }
        indexOf(/ALTER TABLE "csi_dimensions" ALTER COLUMN "name" TYPE varchar\(300\)/);
        indexOf(/ALTER TABLE "csi_period_ratee_dimensions" ALTER COLUMN "dimensionName" TYPE varchar\(300\)/);

        const periodColumns = statements[indexOf(/ALTER TABLE "csi_periods" ADD COLUMN IF NOT EXISTS "teamEnabled"/)];
        expect(periodColumns).toContain(`"teamEnabled" boolean NOT NULL DEFAULT false`);
        expect(periodColumns).toContain(`"teamLabel" varchar(100) NOT NULL DEFAULT 'Tim IT Support'`);
        expect(periodColumns).toContain(`"individualEnabled" boolean NOT NULL DEFAULT true`);
        expect(periodColumns).toContain(`"slaTargetPct" smallint NOT NULL DEFAULT 80`);

        indexOf(/ALTER TABLE "csi_period_ratees" ADD COLUMN IF NOT EXISTS "kind" varchar\(10\) NOT NULL DEFAULT 'PERSON'/);
        indexOf(/ALTER TABLE "csi_period_ratees" ALTER COLUMN "userId" DROP NOT NULL/);
        indexOf(/CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_team" ON "csi_period_ratees" \("periodId"\) WHERE "kind" = 'TEAM'/);
        indexOf(/CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_sites_period_site" ON "csi_period_sites" \("periodId", "siteId"\)/);
        // Response columns belong to Task 3.
        expect(statements.some((sql) => /csi_response/.test(sql))).toBe(false);
    });

    it('down restores siteId from the first period site before dropping the table', async () => {
        await migration.down(queryRunner);
        const addSiteId = indexOf(/ALTER TABLE "csi_periods" ADD COLUMN "siteId" uuid NULL REFERENCES "sites"\("id"\)/);
        const restore = indexOf(/UPDATE "csi_periods" p SET "siteId" = \(\s*SELECT ps."siteId" FROM "csi_period_sites" ps/);
        const notNull = indexOf(/ALTER TABLE "csi_periods" ALTER COLUMN "siteId" SET NOT NULL/);
        const dropSites = indexOf(/DROP TABLE IF EXISTS "csi_period_sites"/);
        expect(addSiteId).toBeLessThan(restore);
        expect(restore).toBeLessThan(notNull);
        expect(notNull).toBeLessThan(dropSites);
        indexOf(/CREATE INDEX IF NOT EXISTS "IDX_csi_periods_scope_site_start" ON "csi_periods" \("scope", "siteId", "startDate"\)/);
        const deleteTeam = indexOf(/DELETE FROM "csi_period_ratees" WHERE "kind" = 'TEAM'/);
        expect(deleteTeam).toBeLessThan(indexOf(/ALTER TABLE "csi_period_ratees" ALTER COLUMN "userId" SET NOT NULL/));
        indexOf(/ALTER TABLE "csi_dimensions" DROP COLUMN IF EXISTS "type"/);
        indexOf(/ALTER TABLE "csi_period_ratee_dimensions" DROP COLUMN IF EXISTS "type".*DROP COLUMN IF EXISTS "options"/);
    });
});
