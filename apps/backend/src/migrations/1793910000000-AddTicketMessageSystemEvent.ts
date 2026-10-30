import { MigrationInterface, QueryRunner } from 'typeorm';

/** Structured activity on system messages, so the chat shows who changed what without parsing text. */
export class AddTicketMessageSystemEvent1793910000000 implements MigrationInterface {
    name = 'AddTicketMessageSystemEvent1793910000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "systemEvent" jsonb NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_messages" DROP COLUMN IF EXISTS "systemEvent"`);
    }
}
