import { MigrationInterface, QueryRunner } from 'typeorm';

/** Waiting Vendor appointment: when the vendor is expected, and the PIC reminder scheduled for it. */
export class AddTicketVendorVisit1793900000000 implements MigrationInterface {
    name = 'AddTicketVendorVisit1793900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "vendorVisitAt" TIMESTAMP NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "vendorVisitReminderId" uuid NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "vendorVisitReminderId"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "vendorVisitAt"`);
    }
}
