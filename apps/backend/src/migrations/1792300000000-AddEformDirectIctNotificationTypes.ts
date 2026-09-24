import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notification types for the Synology direct-to-IT flow.
 *
 * EFORM_DIRECT_TO_ICT  — a request that skipped manager approval landed with IT.
 * EFORM_FULFILLED      — IT granted access without issuing credentials.
 *
 * The enum type has been created under two names across environments
 * (TypeORM's default `notifications_type_enum` and the hand-written
 * `notification_type_enum` used by earlier migrations), so both are handled.
 */
export class AddEformDirectIctNotificationTypes1792300000000 implements MigrationInterface {
    name = 'AddEformDirectIctNotificationTypes1792300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const candidates = ['notifications_type_enum', 'notification_type_enum'];
        const values = ['EFORM_DIRECT_TO_ICT', 'EFORM_FULFILLED'];

        for (const typeName of candidates) {
            const exists = await queryRunner.query(
                `SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1) AS "exists"`,
                [typeName],
            );
            if (!exists[0]?.exists) continue;

            for (const value of values) {
                await queryRunner.query(
                    `ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}'`,
                );
            }
        }
    }

    public async down(): Promise<void> {
        // PostgreSQL does not support dropping enum values from existing enum types
    }
}
