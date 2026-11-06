import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CSI HC per PIC: the employee directory (csi_org_people), the PIC master (csi_pics), PIC ratees in periods
 * (picId + service/bagian snapshot), the "respondent picks the PICs" period mode and the respondent's organisation
 * snapshot on each response. Additive only: no existing row is changed or removed.
 */
export class CsiHcPicsAndOrg1794170000000 implements MigrationInterface {
    name = 'CsiHcPicsAndOrg1794170000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_org_people" (
            "nik" varchar(20) NOT NULL,
            "fullName" varchar(150) NOT NULL,
            "division" varchar(100) NULL,
            "department" varchar(100) NULL,
            "bagian" varchar(150) NULL,
            "jobTitle" varchar(150) NULL,
            "jobLevel" varchar(50) NULL,
            "workLocation" varchar(50) NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_csi_org_people" PRIMARY KEY ("nik")
        )`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "csi_pics" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "scope" varchar(10) NOT NULL,
            "nik" varchar(20) NOT NULL,
            "fullName" varchar(150) NOT NULL,
            "jobTitle" varchar(150) NULL,
            "serviceCode" varchar(10) NOT NULL,
            "bagian" varchar(150) NULL,
            "workLocation" varchar(50) NULL,
            "siteId" uuid NULL,
            "userId" uuid NULL,
            "photoUrl" varchar NULL,
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_csi_pics" PRIMARY KEY ("id"),
            CONSTRAINT "FK_csi_pics_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_pics_scope_nik" ON "csi_pics" ("scope", "nik")`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees"
            ADD COLUMN IF NOT EXISTS "picId" uuid NULL,
            ADD COLUMN IF NOT EXISTS "serviceCode" varchar(10) NULL,
            ADD COLUMN IF NOT EXISTS "bagian" varchar(150) NULL`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "csi_period_ratees" ADD CONSTRAINT "FK_csi_period_ratees_pic" FOREIGN KEY ("picId") REFERENCES "csi_pics"("id") ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_period_pic" ON "csi_period_ratees" ("periodId", "picId") WHERE "picId" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "csi_periods"
            ADD COLUMN IF NOT EXISTS "respondentPicks" boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "unitRules" jsonb NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "targetRespondents" integer NULL`);
        await queryRunner.query(`ALTER TABLE "csi_responses"
            ADD COLUMN IF NOT EXISTS "respondentNik" varchar(20) NULL,
            ADD COLUMN IF NOT EXISTS "orgDivision" varchar(100) NULL,
            ADD COLUMN IF NOT EXISTS "orgDepartment" varchar(100) NULL,
            ADD COLUMN IF NOT EXISTS "orgBagian" varchar(150) NULL,
            ADD COLUMN IF NOT EXISTS "orgLocation" varchar(10) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csi_responses"
            DROP COLUMN IF EXISTS "orgLocation", DROP COLUMN IF EXISTS "orgBagian", DROP COLUMN IF EXISTS "orgDepartment",
            DROP COLUMN IF EXISTS "orgDivision", DROP COLUMN IF EXISTS "respondentNik"`);
        await queryRunner.query(`ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "targetRespondents", DROP COLUMN IF EXISTS "unitRules", DROP COLUMN IF EXISTS "respondentPicks"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_csi_period_ratees_period_pic"`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees" DROP CONSTRAINT IF EXISTS "FK_csi_period_ratees_pic"`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees" DROP COLUMN IF EXISTS "bagian", DROP COLUMN IF EXISTS "serviceCode", DROP COLUMN IF EXISTS "picId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_pics"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_org_people"`);
    }
}
