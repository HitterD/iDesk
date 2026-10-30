import { MigrationInterface, QueryRunner } from 'typeorm';

const CREATE_TABLES = [
    `CREATE TABLE IF NOT EXISTS "csi_dimensions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "scope" varchar(10) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" varchar(300) NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_departments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "scope" varchar(10) NOT NULL,
        "name" varchar(100) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_raters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "scope" varchar(10) NOT NULL,
        "userId" uuid NOT NULL REFERENCES "users"("id"),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_periods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "scope" varchar(10) NOT NULL,
        "siteId" uuid NOT NULL REFERENCES "sites"("id"),
        "title" varchar(150) NOT NULL,
        "intro" text NOT NULL,
        "thankYou" text NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "respondentMode" varchar(10) NOT NULL,
        "createdById" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_period_ratees" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "periodId" uuid NOT NULL REFERENCES "csi_periods"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id"),
        "displayName" varchar(150) NOT NULL,
        "jobTitle" varchar(150) NULL,
        "sortOrder" integer NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_period_ratee_dimensions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "periodRateeId" uuid NOT NULL REFERENCES "csi_period_ratees"("id") ON DELETE CASCADE,
        "dimensionId" uuid NOT NULL REFERENCES "csi_dimensions"("id"),
        "dimensionName" varchar(100) NOT NULL,
        "sortOrder" integer NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_period_raters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "periodId" uuid NOT NULL REFERENCES "csi_periods"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id"),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_responses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "periodId" uuid NOT NULL REFERENCES "csi_periods"("id"),
        "respondentId" uuid NOT NULL REFERENCES "users"("id"),
        "departmentId" uuid NOT NULL REFERENCES "csi_departments"("id"),
        "departmentName" varchar(100) NOT NULL,
        "submittedAt" timestamptz NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_response_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "responseId" uuid NOT NULL REFERENCES "csi_responses"("id") ON DELETE CASCADE,
        "periodRateeId" uuid NOT NULL REFERENCES "csi_period_ratees"("id"),
        "periodRateeDimensionId" uuid NOT NULL REFERENCES "csi_period_ratee_dimensions"("id"),
        "score" smallint NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_csi_response_items_score" CHECK ("score" BETWEEN 1 AND 5)
    )`,
    `CREATE TABLE IF NOT EXISTS "csi_response_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "responseId" uuid NOT NULL REFERENCES "csi_responses"("id") ON DELETE CASCADE,
        "periodRateeId" uuid NOT NULL REFERENCES "csi_period_ratees"("id"),
        "comment" varchar(1000) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
    )`,
];

const CREATE_INDEXES = [
    `CREATE INDEX IF NOT EXISTS "IDX_csi_dimensions_scope" ON "csi_dimensions" ("scope")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_departments_scope_name" ON "csi_departments" ("scope", lower("name"))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_raters_scope_user" ON "csi_raters" ("scope", "userId")`,
    `CREATE INDEX IF NOT EXISTS "IDX_csi_periods_scope_site_start" ON "csi_periods" ("scope", "siteId", "startDate")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_period_user" ON "csi_period_ratees" ("periodId", "userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratee_dimensions_ratee_dimension" ON "csi_period_ratee_dimensions" ("periodRateeId", "dimensionId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_raters_period_user" ON "csi_period_raters" ("periodId", "userId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_responses_period_respondent" ON "csi_responses" ("periodId", "respondentId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_response_items_response_dimension" ON "csi_response_items" ("responseId", "periodRateeDimensionId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_response_comments_response_ratee" ON "csi_response_comments" ("responseId", "periodRateeId")`,
];

const DROP_TABLES = [
    'csi_response_comments', 'csi_response_items', 'csi_responses', 'csi_period_raters',
    'csi_period_ratee_dimensions', 'csi_period_ratees', 'csi_periods', 'csi_raters',
    'csi_departments', 'csi_dimensions',
];

export class AddCsiModule1793980000000 implements MigrationInterface {
    name = 'AddCsiModule1793980000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const sql of [...CREATE_TABLES, ...CREATE_INDEXES]) {
            await queryRunner.query(sql);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const table of DROP_TABLES) {
            await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
        }
    }
}
