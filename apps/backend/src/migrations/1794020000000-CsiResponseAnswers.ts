import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CSI revision 2, responses: editable respondent name (one response per account+name, case/space-insensitive)
 * and typed answers (score becomes nullable; label/text snapshots).
 */
const UP = [
    `ALTER TABLE "csi_responses" ADD COLUMN IF NOT EXISTS "respondentName" varchar(150)`,
    `UPDATE "csi_responses" r SET "respondentName" = u."fullName" FROM "users" u WHERE u."id" = r."respondentId" AND r."respondentName" IS NULL`,
    `ALTER TABLE "csi_responses" ALTER COLUMN "respondentName" SET NOT NULL`,
    `DROP INDEX IF EXISTS "UQ_csi_responses_period_respondent"`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_responses_period_respondent_name" ON "csi_responses" ("periodId", "respondentId", lower(btrim("respondentName")))`,
    `ALTER TABLE "csi_response_items" ALTER COLUMN "score" DROP NOT NULL`,
    `ALTER TABLE "csi_response_items" ADD COLUMN IF NOT EXISTS "answerLabel" varchar(200) NULL,
        ADD COLUMN IF NOT EXISTS "answerText" varchar(1000) NULL`,
];

const DOWN = [
    `ALTER TABLE "csi_response_items" DROP COLUMN IF EXISTS "answerLabel", DROP COLUMN IF EXISTS "answerText"`,
    // Typed answers without a score cannot exist under the old schema.
    `DELETE FROM "csi_response_items" WHERE "score" IS NULL`,
    `ALTER TABLE "csi_response_items" ALTER COLUMN "score" SET NOT NULL`,
    `DROP INDEX IF EXISTS "UQ_csi_responses_period_respondent_name"`,
    // Keep the earliest response per account so the old unique index can be rebuilt.
    `DELETE FROM "csi_responses" r USING "csi_responses" k
        WHERE r."periodId" = k."periodId" AND r."respondentId" = k."respondentId"
        AND (r."submittedAt", r."id") > (k."submittedAt", k."id")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_responses_period_respondent" ON "csi_responses" ("periodId", "respondentId")`,
    `ALTER TABLE "csi_responses" DROP COLUMN IF EXISTS "respondentName"`,
];

export class CsiResponseAnswers1794020000000 implements MigrationInterface {
    name = 'CsiResponseAnswers1794020000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const sql of UP) await queryRunner.query(sql);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const sql of DOWN) await queryRunner.query(sql);
    }
}
