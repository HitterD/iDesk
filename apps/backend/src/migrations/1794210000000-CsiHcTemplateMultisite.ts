import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive template identity and custom-team foundation; existing teams remain SITE teams. */
export class CsiHcTemplateMultisite1794210000000 implements MigrationInterface {
    name = 'CsiHcTemplateMultisite1794210000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_assignment_template_raters"
            ADD COLUMN IF NOT EXISTS "raterNik" varchar(20) NULL,
            ADD COLUMN IF NOT EXISTS "confirmedAt" timestamp NULL,
            ADD COLUMN IF NOT EXISTS "confirmedById" uuid NULL`);
        await queryRunner.query(`ALTER TABLE "csi_teams"
            ADD COLUMN IF NOT EXISTS "kind" varchar(10) NOT NULL DEFAULT 'SITE',
            ADD COLUMN IF NOT EXISTS "serviceCode" varchar(10) NULL`);
        await queryRunner.query(`ALTER TABLE "csi_assignment_template_pics"
            ADD COLUMN IF NOT EXISTS "picNik" varchar(20) NULL,
            ADD COLUMN IF NOT EXISTS "teamId" uuid NULL REFERENCES "csi_teams"("id") ON DELETE SET NULL`);
        await queryRunner.query('ALTER TABLE "csi_pics" ADD COLUMN IF NOT EXISTS "tagline" varchar(90) NULL');
        await queryRunner.query('ALTER TABLE "csi_teams" DROP CONSTRAINT IF EXISTS "UQ_csi_teams_scope_site"');
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_teams_site_kind" ON "csi_teams" ("scope", "siteId") WHERE "kind" = 'SITE'`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_team_members" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "teamId" uuid NOT NULL REFERENCES "csi_teams"("id") ON DELETE CASCADE,
            "userId" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
            "name" varchar(150) NOT NULL,
            "nik" varchar(20) NULL,
            "sortOrder" int NOT NULL DEFAULT 0,
            CONSTRAINT "UQ_csi_team_members_team_name" UNIQUE ("teamId", "name")
        )`);
        await queryRunner.query('DROP INDEX IF EXISTS "UQ_csi_period_ratees_team_site"');
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_team" ON "csi_period_ratees" ("periodId", "teamId") WHERE "kind" = 'TEAM'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Old uniqueness cannot represent multiple custom teams per site: fail rather than discard data.
        await queryRunner.query(`DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_csi_teams_scope_site'
                AND conrelid = 'csi_teams'::regclass) THEN
                ALTER TABLE "csi_teams" ADD CONSTRAINT "UQ_csi_teams_scope_site" UNIQUE ("scope", "siteId");
            END IF;
        END $$`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_team_site" ON "csi_period_ratees" ("periodId", "siteId") WHERE "kind" = 'TEAM'`);
        await queryRunner.query('DROP INDEX IF EXISTS "UQ_csi_period_ratees_team"');
        await queryRunner.query('DROP INDEX IF EXISTS "UQ_csi_teams_site_kind"');
        await queryRunner.query('DROP TABLE IF EXISTS "csi_team_members"');
        await queryRunner.query('ALTER TABLE "csi_assignment_template_pics" DROP COLUMN IF EXISTS "teamId", DROP COLUMN IF EXISTS "picNik"');
        await queryRunner.query('ALTER TABLE "csi_teams" DROP COLUMN IF EXISTS "kind", DROP COLUMN IF EXISTS "serviceCode"');
        await queryRunner.query('ALTER TABLE "csi_pics" DROP COLUMN IF EXISTS "tagline"');
        await queryRunner.query(`ALTER TABLE "csi_assignment_template_raters"
            DROP COLUMN IF EXISTS "confirmedById", DROP COLUMN IF EXISTS "confirmedAt", DROP COLUMN IF EXISTS "raterNik"`);
    }
}
