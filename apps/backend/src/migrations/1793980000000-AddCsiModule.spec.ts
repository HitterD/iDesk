import { QueryRunner } from 'typeorm';
import { AddCsiModule1793980000000 } from './1793980000000-AddCsiModule';

const TABLES = [
    'csi_dimensions', 'csi_departments', 'csi_raters', 'csi_periods',
    'csi_period_ratees', 'csi_period_ratee_dimensions', 'csi_period_raters',
    'csi_responses', 'csi_response_items', 'csi_response_comments',
];

describe('AddCsiModule1793980000000', () => {
    const migration = new AddCsiModule1793980000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = {
            query: jest.fn(async (sql: string) => { statements.push(sql); }),
        } as unknown as QueryRunner;
    });

    it('creates all ten CSI tables idempotently with UUID keys and timestamps', async () => {
        await migration.up(queryRunner);
        const creates = statements.filter(sql => /CREATE TABLE/.test(sql));
        expect(creates).toHaveLength(TABLES.length);
        TABLES.forEach(table => {
            const sql = creates.find(statement => statement.includes(`"${table}"`));
            expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
            expect(sql).toMatch(/"id" uuid .*PRIMARY KEY/);
            expect(sql).toContain('"createdAt"');
            expect(sql).toContain('"updatedAt"');
        });
    });

    it('enforces one response per respondent and period and integer scores from one to five', async () => {
        await migration.up(queryRunner);
        const sql = statements.join('\n');
        expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "[^"]+" ON "csi_responses"\s*\("periodId", "respondentId"\)/);
        expect(sql).toContain('"score" smallint NOT NULL');
        expect(sql).toMatch(/CHECK\s*\("score" BETWEEN 1 AND 5\)/);
        expect(sql).toMatch(/ON "csi_departments"\s*\("scope", lower\("name"\)\)/);
    });

    it('drops all tables in reverse dependency order', async () => {
        await migration.down(queryRunner);
        expect(statements).toEqual([...TABLES].reverse().map(table => `DROP TABLE IF EXISTS "${table}"`));
    });
});
