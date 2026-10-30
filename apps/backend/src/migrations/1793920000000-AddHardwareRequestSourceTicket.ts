import { MigrationInterface, QueryRunner } from 'typeorm';

/** Hardware requests proposed from an IT support ticket: the ticket they came from and who proposed them. */
export class AddHardwareRequestSourceTicket1793920000000 implements MigrationInterface {
    name = 'AddHardwareRequestSourceTicket1793920000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "sourceTicketId" uuid NULL`);
        await queryRunner.query(`ALTER TABLE "hardware_requests" ADD COLUMN IF NOT EXISTS "proposedById" uuid NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_hardware_requests_sourceTicketId" ON "hardware_requests" ("sourceTicketId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hardware_requests_sourceTicketId"`);
        await queryRunner.query(`ALTER TABLE "hardware_requests" DROP COLUMN IF EXISTS "proposedById"`);
        await queryRunner.query(`ALTER TABLE "hardware_requests" DROP COLUMN IF EXISTS "sourceTicketId"`);
    }
}
