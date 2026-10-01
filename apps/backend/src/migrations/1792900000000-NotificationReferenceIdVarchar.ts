import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * notifications.referenceId was a uuid column, but hardware-request notifications store
 * suffixed keys such as `<requestId>_submitted` (one per workflow step, used for dedup).
 * Postgres rejected those inserts, so hardware notifications were never saved.
 * varchar keeps every existing uuid value and allows the suffixed keys.
 */
export class NotificationReferenceIdVarchar1792900000000 implements MigrationInterface {
    name = 'NotificationReferenceIdVarchar1792900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "notifications" ALTER COLUMN "referenceId" TYPE varchar USING "referenceId"::text`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rows with suffixed keys cannot be cast back to uuid; clear them first.
        await queryRunner.query(
            `UPDATE "notifications" SET "referenceId" = NULL WHERE "referenceId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
        );
        await queryRunner.query(
            `ALTER TABLE "notifications" ALTER COLUMN "referenceId" TYPE uuid USING "referenceId"::uuid`,
        );
    }
}
