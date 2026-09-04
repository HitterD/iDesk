import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSlaAdjustments1790000000000 implements MigrationInterface {
    name = 'AddSlaAdjustments1790000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Anchor for SLA-extend accounting (see ticket.entity originalSlaTarget)
        await queryRunner.query(
            `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "originalSlaTarget" timestamp`,
        );

        // Extend history: every SLA extension records why it happened
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "sla_adjustments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticketId" uuid NOT NULL,
                "type" varchar NOT NULL DEFAULT 'EXTEND',
                "minutes" integer NOT NULL,
                "reasonCategory" varchar NOT NULL,
                "reasonText" varchar(1000) NOT NULL,
                "previousTarget" timestamp,
                "newTarget" timestamp,
                "actorId" uuid,
                "approvedById" uuid,
                "createdAt" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_sla_adjustments_id" PRIMARY KEY ("id")
            )`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_sla_adjustments_ticket_id" ON "sla_adjustments" ("ticketId")`,
        );
        // Postgres has no ADD CONSTRAINT IF NOT EXISTS; use a DO block.
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "sla_adjustments" ADD CONSTRAINT "FK_sla_adjustments_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_sla_adjustments_ticket_created" ON "sla_adjustments" ("ticketId", "createdAt")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sla_adjustments_ticket_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sla_adjustments_ticket_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sla_adjustments"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "originalSlaTarget"`);
    }
}
