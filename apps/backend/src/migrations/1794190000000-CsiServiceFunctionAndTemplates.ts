import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CSI HC: the service function (fungsi pelayanan) of each PIC, snapshotted on period ratees. Additive only.
 */
export class CsiServiceFunctionAndTemplates1794190000000 implements MigrationInterface {
    name = 'CsiServiceFunctionAndTemplates1794190000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_pics"
            ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees"
            ADD COLUMN IF NOT EXISTS "serviceFunction" varchar(150) NULL`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_service_report_owners" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "scope" varchar(10) NOT NULL,
            "serviceCode" varchar(10) NOT NULL,
            "userId" uuid NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_csi_service_report_owners" PRIMARY KEY ("id"),
            CONSTRAINT "FK_csi_service_report_owners_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_service_report_owners" ON "csi_service_report_owners" ("scope", "serviceCode", "userId")`);
        await this.createTemplateTables(queryRunner);
    }

    /** Assignment templates per location: template → PICs (by name) → raters (by name). */
    private async createTemplateTables(queryRunner: QueryRunner) {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_assignment_templates" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "scope" varchar(10) NOT NULL,
            "locationCode" varchar(10) NOT NULL,
            "name" varchar(150) NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_csi_assignment_templates" PRIMARY KEY ("id")
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_assignment_templates_scope_location" ON "csi_assignment_templates" ("scope", "locationCode")`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_assignment_template_pics" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "templateId" uuid NOT NULL,
            "area" varchar(60) NOT NULL,
            "serviceCode" varchar(10) NOT NULL,
            "picName" varchar(150) NOT NULL,
            "jobTitle" varchar(150) NULL,
            "serviceFunction" varchar(150) NULL,
            "picId" uuid NULL,
            "sortOrder" integer NOT NULL DEFAULT 0,
            CONSTRAINT "PK_csi_assignment_template_pics" PRIMARY KEY ("id"),
            CONSTRAINT "FK_csi_assignment_template_pics_template" FOREIGN KEY ("templateId") REFERENCES "csi_assignment_templates"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_csi_assignment_template_pics_pic" FOREIGN KEY ("picId") REFERENCES "csi_pics"("id") ON DELETE SET NULL
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_assignment_template_pics_name" ON "csi_assignment_template_pics" ("templateId", "picName")`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_assignment_template_raters" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "templatePicId" uuid NOT NULL,
            "raterName" varchar(150) NOT NULL,
            "raterJobTitle" varchar(150) NULL,
            "userId" uuid NULL,
            CONSTRAINT "PK_csi_assignment_template_raters" PRIMARY KEY ("id"),
            CONSTRAINT "FK_csi_assignment_template_raters_pic" FOREIGN KEY ("templatePicId") REFERENCES "csi_assignment_template_pics"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_csi_assignment_template_raters_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_assignment_template_raters_name" ON "csi_assignment_template_raters" ("templatePicId", "raterName")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_assignment_template_raters"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_assignment_template_pics"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_assignment_templates"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_service_report_owners"`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees" DROP COLUMN IF EXISTS "serviceFunction"`);
        await queryRunner.query(`ALTER TABLE "csi_pics" DROP COLUMN IF EXISTS "serviceFunction"`);
    }
}
