import { QueryRunner } from 'typeorm';
import { AddCsiPeriodStatus1793990000000 } from './1793990000000-AddCsiPeriodStatus';

describe('AddCsiPeriodStatus1793990000000', () => {
    const migration = new AddCsiPeriodStatus1793990000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = {
            query: jest.fn(async (sql: string) => { statements.push(sql); }),
        } as unknown as QueryRunner;
    });

    it('adds the publish status column idempotently, defaulting existing periods to PUBLISHED', async () => {
        await migration.up(queryRunner);
        expect(statements).toEqual([
            `ALTER TABLE "csi_periods" ADD COLUMN IF NOT EXISTS "status" varchar(10) NOT NULL DEFAULT 'PUBLISHED'`,
        ]);
    });

    it('drops the column on down', async () => {
        await migration.down(queryRunner);
        expect(statements).toEqual([`ALTER TABLE "csi_periods" DROP COLUMN IF EXISTS "status"`]);
    });
});
