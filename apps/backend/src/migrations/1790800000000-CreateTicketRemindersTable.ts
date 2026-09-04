import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketRemindersTable1790800000000 implements MigrationInterface {
    name = 'CreateTicketRemindersTable1790800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "ticket_reminders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticketId" uuid NOT NULL,
                "remindAt" timestamp NOT NULL,
                "note" text,
                "isSent" boolean NOT NULL DEFAULT false,
                "sentAt" timestamp,
                "createdById" uuid,
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "updatedAt" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_reminders_id" PRIMARY KEY ("id")
            )`,
        );

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_ticket_reminders_ticket_id" ON "ticket_reminders" ("ticketId")`,
        );

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_ticket_reminders_is_sent_remind_at" ON "ticket_reminders" ("isSent", "remindAt")`,
        );

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "ticket_reminders" 
                ADD CONSTRAINT "FK_ticket_reminders_ticket" 
                FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "ticket_reminders" 
                ADD CONSTRAINT "FK_ticket_reminders_created_by" 
                FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ticket_reminders_is_sent_remind_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ticket_reminders_ticket_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_reminders"`);
    }
}
