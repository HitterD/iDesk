import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AWAITING_CONFIRMATION: IT gave the access of an e-form request ticket and the requester has to try it.
 *
 * Only the value is added. TypeORM runs every pending migration in one transaction and Postgres refuses to use an enum
 * value added in that same transaction, so nothing here (or in a later migration of the same run) may use it.
 */
export class EformAwaitingConfirmation1794840000000 implements MigrationInterface {
    name = 'EformAwaitingConfirmation1794840000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "eform_requests_status_enum" ADD VALUE IF NOT EXISTS 'AWAITING_CONFIRMATION'`);
    }

    public async down(): Promise<void> {
        // Postgres cannot drop an enum value; AWAITING_CONFIRMATION stays (unused) after a rollback.
    }
}
