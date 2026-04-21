import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupTicketingSchedule1776000301000 implements MigrationInterface {
    name = 'CleanupTicketingSchedule1776000301000';

    async up(q: QueryRunner): Promise<void> {
        // Drop ticket_id column from installation_schedules if still exists (legacy ticketing remnant)
        const hasTicketId = await q.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'installation_schedules' AND column_name = 'ticket_id'
        `);
        if (hasTicketId.length) {
            await q.query(`ALTER TABLE installation_schedules DROP COLUMN ticket_id`);
        }
    }

    async down(_q: QueryRunner): Promise<void> {
        // no-op
    }
}
