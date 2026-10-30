import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ticket modules belong to a department scope (ICT today, HC later). Every
 * existing module is an ICT queue.
 */
export class AddTicketModuleScope1793600000000 implements MigrationInterface {
    name = 'AddTicketModuleScope1793600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_modules" ADD COLUMN IF NOT EXISTS "scope" varchar(10) NOT NULL DEFAULT 'ICT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_modules" DROP COLUMN IF EXISTS "scope"`);
    }
}
