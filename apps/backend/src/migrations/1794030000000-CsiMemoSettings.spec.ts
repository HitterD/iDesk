import { QueryRunner } from 'typeorm';
import { CsiMemoSettings1794030000000 } from './1794030000000-CsiMemoSettings';

describe('CsiMemoSettings1794030000000', () => {
    const migration = new CsiMemoSettings1794030000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = { query: jest.fn(async (sql: string) => { statements.push(sql); }) } as unknown as QueryRunner;
    });

    it('creates csi_memo_settings keyed by scope', async () => {
        await migration.up(queryRunner);
        expect(statements).toHaveLength(1);
        expect(statements[0]).toMatch(/CREATE TABLE IF NOT EXISTS "csi_memo_settings"/);
        expect(statements[0]).toMatch(/"scope" varchar\(10\) NOT NULL/);
        expect(statements[0]).toMatch(/"data" jsonb NOT NULL/);
        expect(statements[0]).toMatch(/"updatedAt" timestamp NOT NULL DEFAULT now\(\)/);
        expect(statements[0]).toMatch(/PRIMARY KEY \("scope"\)/);
    });

    it('down drops the table', async () => {
        await migration.down(queryRunner);
        expect(statements).toEqual(['DROP TABLE IF EXISTS "csi_memo_settings"']);
    });
});
