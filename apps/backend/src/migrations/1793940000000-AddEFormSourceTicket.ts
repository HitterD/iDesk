import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E-form access proposed from an IT support ticket: the ticket it came from, who proposed it, and CANCELLED for a
 * proposal the requester declined or IT withdrew before it was signed.
 */
export class AddEFormSourceTicket1793940000000 implements MigrationInterface {
    name = 'AddEFormSourceTicket1793940000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "eform_requests_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED'`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "sourceTicketId" uuid NULL`);
        await queryRunner.query(`ALTER TABLE "eform_requests" ADD COLUMN IF NOT EXISTS "proposedById" uuid NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_eform_requests_sourceTicketId" ON "eform_requests" ("sourceTicketId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eform_requests_sourceTicketId"`);
        await queryRunner.query(`ALTER TABLE "eform_requests" DROP COLUMN IF EXISTS "proposedById"`);
        await queryRunner.query(`ALTER TABLE "eform_requests" DROP COLUMN IF EXISTS "sourceTicketId"`);
        // Postgres cannot drop an enum value; CANCELLED stays (unused) after a rollback.
    }
}
