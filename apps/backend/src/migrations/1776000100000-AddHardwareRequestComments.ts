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
        `);
        const hrcCols = await q.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name='hardware_request_comments'`
        );
        const hrcColNames: string[] = hrcCols.map((r: any) => r.column_name);
        const hrcRequestId = hrcColNames.includes('request_id') ? 'request_id' : '"requestId"';
        const hrcCreatedAt = hrcColNames.includes('created_at') ? 'created_at' : '"createdAt"';
        await q.query(`CREATE INDEX idx_hardware_request_comments_request_created ON hardware_request_comments (${hrcRequestId}, ${hrcCreatedAt});`);
    }
    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS hardware_request_comments;`);
    }
}
