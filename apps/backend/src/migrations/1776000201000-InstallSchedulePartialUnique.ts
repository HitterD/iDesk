import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstallSchedulePartialUnique1776000201000 implements MigrationInterface {
    name = 'InstallSchedulePartialUnique1776000201000';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE installation_schedules DROP CONSTRAINT IF EXISTS uq_installation_schedules_request`);
        const cols = await q.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='installation_schedules'
        `);
        const names = cols.map((r: any) => r.column_name);
        const reqIdCol = names.includes('request_id') ? 'request_id' : '"requestId"';
        await q.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_install_sched_active
            ON installation_schedules(${reqIdCol})
            WHERE status NOT IN ('RESCHEDULED','CANCELLED','DONE');
        `);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS uq_install_sched_active`);
        await q.query(`ALTER TABLE installation_schedules ADD CONSTRAINT uq_installation_schedules_request UNIQUE (request_id)`);
    }
}
