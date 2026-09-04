import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketIdToInstallationSchedules1787882000000 implements MigrationInterface {
    name = 'AddTicketIdToInstallationSchedules1787882000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "installation_schedules" ADD COLUMN IF NOT EXISTS "ticketId" uuid`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_installation_schedules_ticket_id" ON "installation_schedules" ("ticketId")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP INDEX IF EXISTS "idx_installation_schedules_ticket_id"`,
        );
        await queryRunner.query(
            `ALTER TABLE "installation_schedules" DROP COLUMN IF EXISTS "ticketId"`,
        );
    }
}
