import { QueryRunner } from 'typeorm';
import { CsiPeriodCancelAndPairMode1794130000000 } from './1794130000000-CsiPeriodCancelAndPairMode';

describe('CsiPeriodCancelAndPairMode1794130000000', () => {
    const migration = new CsiPeriodCancelAndPairMode1794130000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = { query: jest.fn(async (sql: string) => { statements.push(sql); }) } as unknown as QueryRunner;
    });

    it('adds nullable cancel columns and the pair mode, marking mapped periods CUSTOM', async () => {
        await migration.up(queryRunner);
        expect(statements[0]).toMatch(/"cancelledAt" timestamptz NULL/);
        expect(statements[0]).toMatch(/"cancelledById" uuid NULL REFERENCES "users"\("id"\) ON DELETE SET NULL/);
        expect(statements[0]).toMatch(/"cancelReason" varchar\(500\) NULL/);
        expect(statements[0]).toMatch(/"pairMode" varchar\(10\) NULL/);
        expect(statements[1]).toMatch(/SET "pairMode" = 'CUSTOM'/);
    });

    it('down turns cancelled periods back into drafts before dropping the columns', async () => {
        await migration.down(queryRunner);
        expect(statements[0]).toMatch(/SET "status" = 'DRAFT' WHERE "status" = 'CANCELLED'/);
        expect(statements[1]).toMatch(/DROP COLUMN IF EXISTS "pairMode"/);
    });
});
