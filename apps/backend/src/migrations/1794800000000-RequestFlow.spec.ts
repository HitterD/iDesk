import { QueryRunner } from 'typeorm';
import { RequestFlow1794800000000 } from './1794800000000-RequestFlow';

describe('RequestFlow migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        const runner = { query: async (sql: string) => { queries.push(sql); } };
        await new RequestFlow1794800000000()[direction](runner as unknown as QueryRunner);
        return queries;
    };

    it('adds both request ticket types without replacing the enum', async () => {
        expect(await run('up')).toEqual(expect.arrayContaining([
            `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'HARDWARE_REQUEST'`,
            `ALTER TYPE "tickets_tickettype_enum" ADD VALUE IF NOT EXISTS 'EFORM_REQUEST'`,
        ]));
    });

    it('creates flows linked to tickets and their request details', async () => {
        const sql = (await run('up')).join('\n');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "request_flows"');
        expect(sql).toContain('"ticketId" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE');
        expect(sql).toContain('"hardwareRequestId" uuid REFERENCES "hardware_requests"("id")');
        expect(sql).toContain('"eformRequestId" uuid REFERENCES "eform_requests"("id")');
        expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_request_flows_ticketId" ON "request_flows" ("ticketId")');
        expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_request_flows_managerId" ON "request_flows" ("managerId")');
        expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_request_flows_gmId" ON "request_flows" ("gmId")');
    });

    it('creates revisions with one row per flow version and cascading deletion', async () => {
        const sql = (await run('up')).join('\n');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "request_document_revisions"');
        expect(sql).toContain('"flowId" uuid NOT NULL REFERENCES "request_flows"("id") ON DELETE CASCADE');
        expect(sql).toContain('UNIQUE ("flowId", "version")');
    });

    it('drops only the new tables in dependency order on rollback', async () => {
        expect(await run('down')).toEqual([
            'DROP TABLE IF EXISTS "request_document_revisions"',
            'DROP TABLE IF EXISTS "request_flows"',
        ]);
    });
});
