import { QueryRunner } from 'typeorm';
import { CsiPeriodStatusDefaultDraft1794000000000 } from './1794000000000-CsiPeriodStatusDefaultDraft';

describe('CsiPeriodStatusDefaultDraft1794000000000', () => {
    const migration = new CsiPeriodStatusDefaultDraft1794000000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = {
            query: jest.fn(async (sql: string) => { statements.push(sql); }),
        } as unknown as QueryRunner;
    });

    it('makes new periods default to DRAFT without touching existing rows', async () => {
        await migration.up(queryRunner);
        expect(statements).toEqual([`ALTER TABLE "csi_periods" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`]);
    });

    it('restores the PUBLISHED default on down', async () => {
        await migration.down(queryRunner);
        expect(statements).toEqual([`ALTER TABLE "csi_periods" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED'`]);
    });
});
