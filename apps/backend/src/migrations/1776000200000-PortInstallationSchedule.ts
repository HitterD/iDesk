import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortInstallationSchedule1776000200000 implements MigrationInterface {
    name = 'PortInstallationSchedule1776000200000';

    async up(q: QueryRunner): Promise<void> {
        const hasOldTable = await q.hasTable('installation_schedules');

        if (hasOldTable) {
            const cols = await q.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name='installation_schedules'
            `);
            const names = cols.map((r: any) => r.column_name);

            // rename ticket_id → request_id bila perlu
            if (names.includes('ticket_id') && !names.includes('request_id')) {
                await q.query(`ALTER TABLE installation_schedules RENAME COLUMN ticket_id TO request_id`);
            }

            // drop FK lama ke tickets, buat FK baru ke hardware_requests
            await q.query(`
                ALTER TABLE installation_schedules
                DROP CONSTRAINT IF EXISTS fk_installation_schedules_ticket;
            `);

            // pastikan kolom baru ada
            const addCol = async (c: string, type: string, def = '') => {
                if (!names.includes(c)) await q.query(
                    `ALTER TABLE installation_schedules ADD COLUMN ${c} ${type} ${def}`,
                );
            };
            await addCol('proposed_by', 'uuid');
            await addCol('confirmed_by', 'uuid', 'NULL');
            await addCol('location_detail', 'text', 'NULL');
            await addCol('reschedule_reason', 'text', 'NULL');
            await addCol('started_at', 'timestamptz', 'NULL');
            await addCol('completed_at', 'timestamptz', 'NULL');

            // ubah status enum bila masih string
            await q.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='install_status_enum') THEN
                        CREATE TYPE install_status_enum AS ENUM
                            ('PROPOSED', 'PROPOSED_AWAITING_USER', 'CONFIRMED','IN_PROGRESS','DONE','RESCHEDULED','CANCELLED');
                    END IF;
                END $$;
            `);
            await q.query(`
                ALTER TABLE installation_schedules
                ALTER COLUMN status DROP DEFAULT,
                ALTER COLUMN status TYPE install_status_enum USING status::text::install_status_enum,
                ALTER COLUMN status SET DEFAULT 'PROPOSED';
            `);

            const reqIdCol = names.includes('request_id') ? 'request_id' : '"requestId"';
            await q.query(`
                ALTER TABLE installation_schedules
                ADD CONSTRAINT fk_installation_schedules_request
                FOREIGN KEY (${reqIdCol}) REFERENCES hardware_requests(id) ON DELETE CASCADE;
            `);
        } else {
            await q.query(`
                DO $$ BEGIN
                    CREATE TYPE install_status_enum AS ENUM
                        ('PROPOSED', 'PROPOSED_AWAITING_USER', 'CONFIRMED','IN_PROGRESS','DONE','RESCHEDULED','CANCELLED');
                EXCEPTION WHEN duplicate_object THEN null; END $$;
            `);
            await q.query(`
                CREATE TABLE IF NOT EXISTS installation_schedules (
                    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                    request_id      uuid NOT NULL UNIQUE REFERENCES hardware_requests(id) ON DELETE CASCADE,
                    technician_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                    scheduled_start timestamptz NOT NULL,
                    scheduled_end   timestamptz NOT NULL,
                    status          install_status_enum NOT NULL DEFAULT 'PROPOSED',
                    proposed_by     uuid NOT NULL,
                    confirmed_by    uuid NULL,
                    location_detail text NULL,
                    reschedule_reason text NULL,
                    started_at      timestamptz NULL,
                    completed_at    timestamptz NULL,
                    created_at      timestamptz NOT NULL DEFAULT now(),
                    updated_at      timestamptz NOT NULL DEFAULT now()
                );
            `);
        }

        const finalCols = await q.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='installation_schedules'
        `);
        const finalNames = finalCols.map((r: any) => r.column_name);
        const techIdCol = finalNames.includes('technician_id') ? 'technician_id' : '"technicianId"';
        const startCol = finalNames.includes('scheduled_start') ? 'scheduled_start' : '"scheduledStart"';
        await q.query(`
            CREATE INDEX IF NOT EXISTS idx_install_sched_tech_start
                ON installation_schedules(${techIdCol}, ${startCol});
        `);
        await q.query(`
            CREATE INDEX IF NOT EXISTS idx_install_sched_status_start
                ON installation_schedules(status, ${startCol});
        `);
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS idx_install_sched_tech_start`);
        await q.query(`DROP INDEX IF EXISTS idx_install_sched_status_start`);
        await q.query(`
            ALTER TABLE installation_schedules
            DROP CONSTRAINT IF EXISTS fk_installation_schedules_request;
        `);
        await q.query(`
            ALTER TABLE installation_schedules
            DROP CONSTRAINT IF EXISTS uq_installation_schedules_request;
        `);
        // biarkan table utk rollback manual (data sensitif)
    }
}
