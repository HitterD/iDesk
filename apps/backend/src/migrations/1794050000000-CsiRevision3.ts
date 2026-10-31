import { MigrationInterface, QueryRunner } from 'typeorm';

/** CSI revision 3: scoped subject masters and explicit rater mappings. */
export class CsiRevision31794050000000 implements MigrationInterface {
    name = 'CsiRevision31794050000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.createMasters(queryRunner);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees"
            ADD "siteId" uuid,
            ADD "teamId" uuid REFERENCES "csi_teams"("id"),
            ADD "photoUrl" varchar,
            ADD "tagline" varchar(90)`);
        await queryRunner.query(`ALTER TABLE "csi_dimensions" ADD "shortLabel" varchar(40)`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratee_dimensions" ADD "shortLabel" varchar(40)`);
        await this.backfillTeams(queryRunner);
        await queryRunner.query(`DROP INDEX "UQ_csi_period_ratees_team"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_csi_period_ratees_team_site" ON "csi_period_ratees" ("periodId", "siteId") WHERE "kind" = 'TEAM'`);
        await queryRunner.query(`CREATE TABLE "csi_period_rater_ratees" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "periodId" uuid NOT NULL REFERENCES "csi_periods"("id") ON DELETE CASCADE,
            "periodRaterId" uuid NOT NULL REFERENCES "csi_period_raters"("id") ON DELETE CASCADE,
            "periodRateeId" uuid NOT NULL REFERENCES "csi_period_ratees"("id") ON DELETE CASCADE,
            CONSTRAINT "UQ_csi_period_rater_ratees_rater_ratee" UNIQUE ("periodRaterId", "periodRateeId")
        )`);
        // Resolve the actual column enum: older installations used a singular type name.
        await queryRunner.query(`DO $$ DECLARE enum_name text; BEGIN
            SELECT format('%I.%I', n.nspname, t.typname) INTO enum_name
            FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE a.attrelid = 'notifications'::regclass AND a.attname = 'type' AND t.typtype = 'e';
            IF enum_name IS NOT NULL THEN
                EXECUTE 'ALTER TYPE ' || enum_name || ' ADD VALUE IF NOT EXISTS ''CSI_REMINDER''';
            END IF;
        END $$`);
    }

    private async createMasters(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "csi_teams" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "scope" varchar(10) NOT NULL,
            "siteId" uuid NOT NULL REFERENCES "sites"("id"),
            "name" varchar(150) NOT NULL,
            "photoUrl" varchar,
            "tagline" varchar(90),
            "jobTitle" varchar(150),
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_csi_teams_scope_site" UNIQUE ("scope", "siteId")
        )`);
        await queryRunner.query(`CREATE TABLE "csi_subject_profiles" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "scope" varchar(10) NOT NULL,
            "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "photoUrl" varchar,
            "tagline" varchar(90),
            "jobTitle" varchar(150),
            CONSTRAINT "UQ_csi_subject_profiles_scope_user" UNIQUE ("scope", "userId")
        )`);
        await queryRunner.query(`CREATE TABLE "csi_rater_assignments" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            "scope" varchar(10) NOT NULL,
            "raterUserId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "subjectKey" varchar(41) NOT NULL,
            CONSTRAINT "UQ_csi_rater_assignments_scope_rater_subject" UNIQUE ("scope", "raterUserId", "subjectKey")
        )`);
    }

    private async backfillTeams(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "csi_period_ratees" r SET "siteId" = u."siteId" FROM "users" u WHERE r."userId" = u.id`);
        await queryRunner.query(`UPDATE "csi_period_ratees" r SET "siteId" = (
            SELECT ps."siteId" FROM "csi_period_sites" ps
            WHERE ps."periodId" = r."periodId" ORDER BY ps."siteId" LIMIT 1
        ) WHERE r."kind" = 'TEAM'`);
        await queryRunner.query(`INSERT INTO "csi_teams" ("scope", "siteId", "name")
            SELECT DISTINCT ON (p."scope", r."siteId") p."scope", r."siteId", p."teamLabel"
            FROM "csi_period_ratees" r JOIN "csi_periods" p ON p.id = r."periodId"
            WHERE r."kind" = 'TEAM' AND r."siteId" IS NOT NULL
            ORDER BY p."scope", r."siteId", p."createdAt", p.id
            ON CONFLICT ("scope", "siteId") DO NOTHING`);
        await queryRunner.query(`UPDATE "csi_period_ratees" r SET "teamId" = t.id
            FROM "csi_periods" p, "csi_teams" t
            WHERE r."periodId" = p.id AND r."kind" = 'TEAM'
            AND t."scope" = p."scope" AND t."siteId" = r."siteId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "csi_period_rater_ratees"`);
        await queryRunner.query(`DROP INDEX "UQ_csi_period_ratees_team_site"`);
        // Refuse rollback rather than delete data if revision 3 added multiple teams per period.
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_csi_period_ratees_team" ON "csi_period_ratees" ("periodId") WHERE "kind" = 'TEAM'`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratee_dimensions" DROP COLUMN "shortLabel"`);
        await queryRunner.query(`ALTER TABLE "csi_dimensions" DROP COLUMN "shortLabel"`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees"
            DROP COLUMN "tagline", DROP COLUMN "photoUrl", DROP COLUMN "teamId", DROP COLUMN "siteId"`);
        await queryRunner.query(`DROP TABLE "csi_rater_assignments"`);
        await queryRunner.query(`DROP TABLE "csi_subject_profiles"`);
        await queryRunner.query(`DROP TABLE "csi_teams"`);
        // PostgreSQL cannot drop an enum value; retain CSI_REMINDER on rollback.
    }
}
