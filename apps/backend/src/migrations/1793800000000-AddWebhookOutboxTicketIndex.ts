import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * iPop chat sync reads the outbox per ticket on every ticket view (last snapshot sent, chat events since the last
 * read event), so look-ups by ticket and event must not scan the whole table.
 */
export class AddWebhookOutboxTicketIndex1793800000000 implements MigrationInterface {
    name = 'AddWebhookOutboxTicketIndex1793800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_webhook_outbox_ticket_event"
            ON "integration_webhook_outbox" ("target", "ticketId", "event", "createdAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_webhook_outbox_ticket_event"`);
    }
}
