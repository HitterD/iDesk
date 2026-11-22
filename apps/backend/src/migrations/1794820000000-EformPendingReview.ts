import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PENDING_REVIEW: an e-form filed from the unified ticket form waits for IT to pick its approval route.
 *
 * Only the value is added. TypeORM runs every pending migration in one transaction and Postgres refuses to use an enum
 * value added in that same transaction, so nothing here (or in a later migration of the same run) may use it.
 */
export class EformPendingReview1794820000000 implements MigrationInterface {
    name = 'EformPendingReview1794820000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "eform_requests_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW'`);
    }

    public async down(): Promise<void> {
        // Postgres cannot drop an enum value; PENDING_REVIEW stays (unused) after a rollback.
    }
}
