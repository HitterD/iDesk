import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRescheduleRequestedEnum1778000000000 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `ALTER TYPE "installation_schedules_status_enum" ADD VALUE IF NOT EXISTS 'RESCHEDULE_REQUESTED'`,
        );
    }

    public async down(qr: QueryRunner): Promise<void> {
        // PostgreSQL does not support dropping enum values
    }
}
