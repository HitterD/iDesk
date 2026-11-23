import { MigrationInterface, QueryRunner } from 'typeorm';

const TYPE_ENUMS = ['notifications_type_enum', 'notification_type_enum'];

/**
 * Columns the unified hardware flow needs, and the aging notification type.
 *
 * - installation_schedules.note: IT's note to the requester when proposing slots.
 * - hardware_request_items.recipient_name: who the unit is for (was kept inside categorySnapshot.customFields).
 * - HARDWARE_REQUEST_AGING: the notification of a request that has not moved for days.
 *
 * Enum types exist under two names across environments (see 1794300000000), so both are handled. Only the value is
 * added: TypeORM runs every pending migration in one transaction and Postgres refuses to use an enum value added in
 * that same transaction, so no row here may carry it.
 */
export class HardwareFlowColumns1794830000000 implements MigrationInterface {
    name = 'HardwareFlowColumns1794830000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "installation_schedules" ADD COLUMN IF NOT EXISTS "note" text`);
        await queryRunner.query(`ALTER TABLE "hardware_request_items" ADD COLUMN IF NOT EXISTS "recipient_name" character varying(120)`);
        for (const typeName of TYPE_ENUMS) {
            if (!(await this.typeExists(queryRunner, typeName))) continue;
            await queryRunner.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS 'HARDWARE_REQUEST_AGING'`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hardware_request_items" DROP COLUMN IF EXISTS "recipient_name"`);
        await queryRunner.query(`ALTER TABLE "installation_schedules" DROP COLUMN IF EXISTS "note"`);
        // Postgres cannot drop an enum value; HARDWARE_REQUEST_AGING stays (unused) after a rollback.
    }

    private async typeExists(queryRunner: QueryRunner, typeName: string): Promise<boolean> {
        const rows = await queryRunner.query(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1) AS "exists"`, [typeName]);
        return Boolean(rows[0]?.exists);
    }
}
