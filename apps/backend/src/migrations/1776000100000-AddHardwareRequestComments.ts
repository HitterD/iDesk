import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHardwareRequestComments1776000100000 implements MigrationInterface {
    name = 'AddHardwareRequestComments1776000100000';

    async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS hardware_request_comments (
                id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                request_id  uuid NOT NULL REFERENCES hardware_requests(id) ON DELETE CASCADE,
                author_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                body        text NOT NULL,
                attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
                created_at  timestamptz NOT NULL DEFAULT now(),
                edited_at   timestamptz NULL,
                deleted_at  timestamptz NULL
            );
            CREATE INDEX idx_hardware_request_comments_request_created
                ON hardware_request_comments (request_id, created_at);
        `);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS hardware_request_comments;`);
    }
}
