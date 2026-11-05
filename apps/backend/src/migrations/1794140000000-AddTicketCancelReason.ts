import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tickets keep why they were cancelled: a fixed reason code (reportable) plus an optional note.
 * Both nullable — tickets cancelled before this, merged or cancelled by a linked request have none.
 */
export class AddTicketCancelReason1794140000000 implements MigrationInterface {
    name = 'AddTicketCancelReason1794140000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets"
            ADD COLUMN IF NOT EXISTS "cancelReasonCode" varchar(30) NULL,
            ADD COLUMN IF NOT EXISTS "cancelReason" varchar(500) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets"
            DROP COLUMN IF EXISTS "cancelReason",
            DROP COLUMN IF EXISTS "cancelReasonCode"`);
    }
}
