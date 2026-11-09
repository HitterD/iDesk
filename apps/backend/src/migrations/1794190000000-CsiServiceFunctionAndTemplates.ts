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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_service_report_owners"`);
        await queryRunner.query(`ALTER TABLE "csi_period_ratees" DROP COLUMN IF EXISTS "serviceFunction"`);
        await queryRunner.query(`ALTER TABLE "csi_pics" DROP COLUMN IF EXISTS "serviceFunction"`);
    }
}
