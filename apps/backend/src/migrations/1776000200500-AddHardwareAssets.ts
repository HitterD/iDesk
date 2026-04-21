import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHardwareAssets1776000200500 implements MigrationInterface {
    name = 'AddHardwareAssets1776000200500';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE hardware_assets (
                id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                item_id              uuid NOT NULL REFERENCES hardware_request_items(id) ON DELETE RESTRICT,
                barcode              varchar(128) NOT NULL UNIQUE,
                assigned_to_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                site_id              uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
                installed_at         timestamptz NOT NULL,
                installed_by         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                created_at           timestamptz NOT NULL DEFAULT now()
            );
        `);
        await q.query(`CREATE INDEX idx_hardware_assets_assignee ON hardware_assets(assigned_to_user_id);`);
        await q.query(`CREATE INDEX idx_hardware_assets_item ON hardware_assets(item_id);`);
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS hardware_assets`);
    }
}
