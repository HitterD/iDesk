import { MigrationInterface, QueryRunner } from 'typeorm';

/** Persistent per-user response drafts for active CSI periods (deleted automatically when the period or user is purged). */
export class CsiResponseDrafts1794650000000 implements MigrationInterface {
    name = 'CsiResponseDrafts1794650000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "csi_response_drafts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "periodId" uuid NOT NULL,
                "respondentId" uuid NOT NULL,
                "departmentId" uuid,
                "position" integer NOT NULL DEFAULT 0,
                "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "comments" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "picks" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_csi_response_drafts" PRIMARY KEY ("id"),
                CONSTRAINT "FK_csi_response_drafts_period" FOREIGN KEY ("periodId") REFERENCES "csi_periods"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_csi_response_drafts_respondent" FOREIGN KEY ("respondentId") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_response_drafts_period_respondent"
            ON "csi_response_drafts" ("periodId", "respondentId")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_csi_response_drafts_respondent"
            ON "csi_response_drafts" ("respondentId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "csi_response_drafts"`);
    }
}
