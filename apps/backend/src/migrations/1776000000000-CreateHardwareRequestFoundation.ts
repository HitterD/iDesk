// apps/backend/src/migrations/1776000000000-CreateHardwareRequestFoundation.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHardwareRequestFoundation1776000000000
    implements MigrationInterface
{
    name = 'CreateHardwareRequestFoundation1776000000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE hr_item_category AS ENUM
                    ('LAPTOP','MONITOR','ACCESSORY','NETWORK','SOFTWARE','OTHER');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE hr_request_status AS ENUM
                    ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED',
                     'CANCELLED','PROCUREMENT','INSTALLATION','COMPLETED');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE hr_activity_action AS ENUM
                    ('CREATED','UPDATED','SUBMITTED','REVIEWED','APPROVED','REJECTED',
                     'CANCELLED','PROCUREMENT_UPDATED','PROCUREMENT_COMPLETED',
                     'INSTALL_SCHEDULED','INSTALL_CONFIRMED','INSTALL_RESCHEDULED',
                     'INSTALL_STARTED','INSTALL_COMPLETED','COMMENTED','BARCODE_SCANNED');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS hardware_catalog (
                id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                code             varchar(80) NOT NULL UNIQUE,
                name             varchar(160) NOT NULL,
                category         hr_item_category NOT NULL,
                default_specs    jsonb NOT NULL DEFAULT '{}'::jsonb,
                required_fields  jsonb NOT NULL DEFAULT '[]'::jsonb,
                active           boolean NOT NULL DEFAULT true,
                display_order    integer NOT NULL DEFAULT 0,
                created_at       timestamptz NOT NULL DEFAULT now(),
                updated_at       timestamptz NOT NULL DEFAULT now()
            )
        `);
        // Index on active + order column (column name varies between snake_case and camelCase installs)
        const catalogCols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='hardware_catalog'`
        );
        const colNames: string[] = catalogCols.map((r: any) => r.column_name);
        const orderCol = colNames.includes('display_order') ? 'display_order' : '"displayOrder"';
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS idx_hardware_catalog_active_order ON hardware_catalog (active, ${orderCol})`
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS hardware_requests (
                id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_number    varchar(32) NOT NULL UNIQUE,
                requester_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                recipient_id      uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                site_id           uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
                justification     text NOT NULL,
                status            hr_request_status NOT NULL DEFAULT 'DRAFT',
                submitted_at      timestamptz NULL,
                reviewed_at       timestamptz NULL,
                approved_at       timestamptz NULL,
                procured_at       timestamptz NULL,
                installed_at      timestamptz NULL,
                completed_at      timestamptz NULL,
                reviewed_by_id    uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                approved_by_id    uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                procured_by_id    uuid NULL REFERENCES users(id) ON DELETE SET NULL,
                reject_reason     text NULL,
                version           integer NOT NULL DEFAULT 1,
                created_at        timestamptz NOT NULL DEFAULT now(),
                updated_at        timestamptz NOT NULL DEFAULT now()
            )
        `);
        // Detect column naming convention (snake_case vs camelCase)
        const hrCols = await queryRunner.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='hardware_requests'`
        );
        const hrColNames: string[] = hrCols.map((r: any) => r.column_name);
        const hrCreatedAt = hrColNames.includes('created_at') ? 'created_at' : '"createdAt"';
        const hrRequesterId = hrColNames.includes('requester_id') ? 'requester_id' : '"requesterId"';
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hardware_requests_status_created ON hardware_requests (status, ${hrCreatedAt} DESC)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hardware_requests_requester_created ON hardware_requests (${hrRequesterId}, ${hrCreatedAt} DESC)`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS hardware_request_items (
                id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_id        uuid NOT NULL REFERENCES hardware_requests(id) ON DELETE CASCADE,
                catalog_id        uuid NULL REFERENCES hardware_catalog(id) ON DELETE SET NULL,
                category_snapshot jsonb NOT NULL,
                quantity          integer NOT NULL CHECK (quantity > 0),
                actual_cost       numeric(14,2) NULL,
                vendor            varchar(255) NULL,
                invoice_number    varchar(100) NULL,
                invoice_date      date NULL,
                notes             text NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hardware_request_items_request ON hardware_request_items (request_id)`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS hardware_request_activities (
                id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_id   uuid NOT NULL REFERENCES hardware_requests(id) ON DELETE CASCADE,
                actor_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                action       hr_activity_action NOT NULL,
                from_status  hr_request_status NULL,
                to_status    hr_request_status NULL,
                metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
                created_at   timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_hardware_request_activities_request_created ON hardware_request_activities (request_id, created_at)`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_request_activities;`);
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_request_items;`);
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_requests;`);
        await queryRunner.query(`DROP TABLE IF EXISTS hardware_catalog;`);
        await queryRunner.query(`DROP TYPE IF EXISTS hr_activity_action;`);
        await queryRunner.query(`DROP TYPE IF EXISTS hr_request_status;`);
        await queryRunner.query(`DROP TYPE IF EXISTS hr_item_category;`);
    }
}
