import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToTickets1787366400000 implements MigrationInterface {
    name = 'AddDeletedAtToTickets1787366400000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`);

        // Partial index: every read now carries "deletedAt IS NULL", and deleted
        // rows are expected to be rare. A full index would waste space on rows
        // that are never scanned.
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tickets_deleted_at" ON "tickets" ("deletedAt") WHERE "deletedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_tickets_deleted_at"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "deletedAt"`);
    }
}
