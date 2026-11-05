import { QueryRunner } from 'typeorm';
import { AddTicketCancelReason1794140000000 } from './1794140000000-AddTicketCancelReason';

describe('AddTicketCancelReason1794140000000', () => {
    const migration = new AddTicketCancelReason1794140000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = { query: jest.fn(async (sql: string) => { statements.push(sql); }) } as unknown as QueryRunner;
    });

    it('adds nullable reason code and note columns to tickets', async () => {
        await migration.up(queryRunner);
        expect(statements[0]).toMatch(/ALTER TABLE "tickets"/);
        expect(statements[0]).toMatch(/"cancelReasonCode" varchar\(30\) NULL/);
        expect(statements[0]).toMatch(/"cancelReason" varchar\(500\) NULL/);
    });

    it('down drops both columns', async () => {
        await migration.down(queryRunner);
        expect(statements[0]).toMatch(/DROP COLUMN IF EXISTS "cancelReason"/);
        expect(statements[0]).toMatch(/DROP COLUMN IF EXISTS "cancelReasonCode"/);
    });
});
