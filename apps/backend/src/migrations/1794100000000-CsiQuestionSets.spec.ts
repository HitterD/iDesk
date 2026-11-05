import { QueryRunner } from 'typeorm';
import { CsiQuestionSets1794100000000 } from './1794100000000-CsiQuestionSets';

describe('CsiQuestionSets1794100000000', () => {
    const migration = new CsiQuestionSets1794100000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = { query: jest.fn(async (sql: string) => { statements.push(sql); }) } as unknown as QueryRunner;
    });

    it('creates csi_question_sets with a per-scope unique name', async () => {
        await migration.up(queryRunner);
        expect(statements).toHaveLength(1);
        expect(statements[0]).toMatch(/CREATE TABLE IF NOT EXISTS "csi_question_sets"/);
        expect(statements[0]).toMatch(/"dimensionIds" jsonb NOT NULL DEFAULT '\[\]'/);
        expect(statements[0]).toMatch(/UNIQUE \("scope", "name"\)/);
    });

    it('down drops the table', async () => {
        await migration.down(queryRunner);
        expect(statements).toEqual(['DROP TABLE IF EXISTS "csi_question_sets"']);
    });
});
