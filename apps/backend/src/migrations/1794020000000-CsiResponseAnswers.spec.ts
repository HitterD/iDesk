import { QueryRunner } from 'typeorm';
import { CsiResponseAnswers1794020000000 } from './1794020000000-CsiResponseAnswers';

describe('CsiResponseAnswers1794020000000', () => {
    const migration = new CsiResponseAnswers1794020000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = { query: jest.fn(async (sql: string) => { statements.push(sql); }) } as unknown as QueryRunner;
    });

    const indexOf = (pattern: RegExp) => {
        const index = statements.findIndex((sql) => pattern.test(sql));
        expect(index).toBeGreaterThanOrEqual(0);
        return index;
    };

    it('backfills respondentName and swaps unique index', async () => {
        await migration.up(queryRunner);
        const addColumn = indexOf(/ALTER TABLE "csi_responses" ADD COLUMN IF NOT EXISTS "respondentName" varchar\(150\)/);
        const backfill = indexOf(/UPDATE "csi_responses" r SET "respondentName" = left\(u."fullName", 150\) FROM "users" u WHERE u."id" = r."respondentId"/);
        const notNull = indexOf(/ALTER TABLE "csi_responses" ALTER COLUMN "respondentName" SET NOT NULL/);
        const dropOld = indexOf(/DROP INDEX IF EXISTS "UQ_csi_responses_period_respondent"/);
        const createNew = indexOf(/CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_responses_period_respondent_name" ON "csi_responses" \("periodId", "respondentId", lower\(btrim\("respondentName"\)\)\)/);
        expect(addColumn).toBeLessThan(backfill);
        expect(backfill).toBeLessThan(notNull);
        expect(notNull).toBeLessThan(createNew);
        expect(dropOld).toBeLessThan(createNew);
        indexOf(/ALTER TABLE "csi_response_items" ALTER COLUMN "score" DROP NOT NULL/);
        const answers = statements[indexOf(/ALTER TABLE "csi_response_items" ADD COLUMN IF NOT EXISTS "answerLabel" varchar\(200\)/)];
        expect(answers).toContain('"answerText" varchar(1000)');
    });

    it('down restores the one-response-per-account index', async () => {
        await migration.down(queryRunner);
        const dropNew = indexOf(/DROP INDEX IF EXISTS "UQ_csi_responses_period_respondent_name"/);
        const createOld = indexOf(/CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_responses_period_respondent" ON "csi_responses" \("periodId", "respondentId"\)/);
        expect(dropNew).toBeLessThan(createOld);
        indexOf(/ALTER TABLE "csi_response_items" ALTER COLUMN "score" SET NOT NULL/);
        indexOf(/DROP COLUMN IF EXISTS "respondentName"/);
    });
});
