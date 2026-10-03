import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records who filed a ticket when staff files it on behalf of another user,
 * so the filer can keep tracking it after it is forwarded elsewhere.
 */
export class AddTicketCreatedBy1793200000000 implements MigrationInterface {
    name = 'AddTicketCreatedBy1793200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "createdById" character varying NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_createdById" ON "tickets" ("createdById")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tickets_createdById"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "createdById"`);
    }
}
