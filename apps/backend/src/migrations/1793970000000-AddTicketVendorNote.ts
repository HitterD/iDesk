import { MigrationInterface, QueryRunner } from 'typeorm';

/** Why a WAITING_VENDOR ticket waits (template or typed by the PIC); null otherwise. */
export class AddTicketVendorNote1793970000000 implements MigrationInterface {
    name = 'AddTicketVendorNote1793970000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "vendorNote" varchar(300) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "vendorNote"`);
    }
}
