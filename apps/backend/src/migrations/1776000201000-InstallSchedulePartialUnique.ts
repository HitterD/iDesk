import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstallSchedulePartialUnique1776000201000 implements MigrationInterface {
    name = 'InstallSchedulePartialUnique1776000201000';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE installation_schedules DROP CONSTRAINT IF EXISTS uq_installation_schedules_request`);
        await q.query(`
            CREATE UNIQUE INDEX uq_install_sched_active
            ON installation_schedules(request_id)
            WHERE status NOT IN ('RESCHEDULED','CANCELLED','DONE');
        `);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS uq_install_sched_active`);
        await q.query(`ALTER TABLE installation_schedules ADD CONSTRAINT uq_installation_schedules_request UNIQUE (request_id)`);
    }
}
