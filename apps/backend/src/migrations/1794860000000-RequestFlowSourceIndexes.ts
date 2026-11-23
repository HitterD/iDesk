import { MigrationInterface, QueryRunner } from 'typeorm';

/** The flow row is looked up (and locked) by its hardware or e-form request on every action; those columns had no index. */
export const CREATE_INDEXES_SQL = [
    `CREATE INDEX IF NOT EXISTS "IDX_request_flows_hardwareRequestId" ON "request_flows" ("hardwareRequestId")`,
    `CREATE INDEX IF NOT EXISTS "IDX_request_flows_eformRequestId" ON "request_flows" ("eformRequestId")`,
] as const;

/** Indexes only: no enum or data change, so it is safe inside the shared migration transaction. */
export class RequestFlowSourceIndexes1794860000000 implements MigrationInterface {
    name = 'RequestFlowSourceIndexes1794860000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const sql of CREATE_INDEXES_SQL) await queryRunner.query(sql);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_request_flows_eformRequestId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_request_flows_hardwareRequestId"`);
    }
}
