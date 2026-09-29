import { MigrationInterface, QueryRunner } from 'typeorm';

const STATUSES_BEFORE = ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED', 'CANCELLED'];
const STATUSES_AFTER = [...STATUSES_BEFORE, 'CLOSED'];

/**
 * Resolution confirmation + per-agent rating:
 * - CLOSED status (final). RESOLVED now means "awaiting requester confirmation".
 * - Existing RESOLVED tickets are closed: they predate the confirmation window.
 * - ticket_assignments keeps every agent ever assigned (filled by a trigger, since
 *   assignedToId is written from many code paths); agent_ratings stores the scores.
 *
 * The enum is recreated instead of `ALTER TYPE ... ADD VALUE` because TypeORM runs
 * migrations in one transaction and Postgres forbids using a value added in the
 * same transaction (the RESOLVED -> CLOSED update below needs it).
 */
export class AddTicketResolutionConfirmation1792800000000 implements MigrationInterface {
    name = 'AddTicketResolutionConfirmation1792800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.recreateStatusEnum(queryRunner, STATUSES_AFTER);

        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolutionDeadlineAt" TIMESTAMP NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP NULL`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP NULL`);
        await queryRunner.query(
            `UPDATE "tickets" SET "status" = 'CLOSED', "closedAt" = COALESCE("resolvedAt", "updatedAt") WHERE "status" = 'RESOLVED'`,
        );

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ticket_assignments" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "ticketId" uuid NOT NULL,
                "agentId" uuid NOT NULL,
                "firstAssignedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_assignments" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_ticket_assignments_ticket_agent" UNIQUE ("ticketId", "agentId"),
                CONSTRAINT "FK_ticket_assignments_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_ticket_assignments_agent" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ticket_assignments_agent" ON "ticket_assignments" ("agentId")`);
        // Only the current assignee is known for existing tickets.
        await queryRunner.query(`
            INSERT INTO "ticket_assignments" ("ticketId", "agentId", "firstAssignedAt")
            SELECT t."id", t."assignedToId"::uuid, t."createdAt"
            FROM "tickets" t
            WHERE t."assignedToId" IS NOT NULL
              AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = t."assignedToId"::uuid)
            ON CONFLICT ("ticketId", "agentId") DO NOTHING
        `);
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION record_ticket_assignment() RETURNS trigger AS $$
            BEGIN
                IF NEW."assignedToId" IS NOT NULL THEN
                    INSERT INTO "ticket_assignments" ("ticketId", "agentId")
                    VALUES (NEW."id", NEW."assignedToId"::uuid)
                    ON CONFLICT ("ticketId", "agentId") DO NOTHING;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_tickets_record_assignment" ON "tickets"`);
        await queryRunner.query(`
            CREATE TRIGGER "trg_tickets_record_assignment"
            AFTER INSERT OR UPDATE OF "assignedToId" ON "tickets"
            FOR EACH ROW EXECUTE FUNCTION record_ticket_assignment()
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "agent_ratings" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "ticketId" uuid NOT NULL,
                "agentId" uuid NOT NULL,
                "raterId" uuid NOT NULL,
                "rating" smallint NOT NULL,
                "comment" text NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_agent_ratings" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_agent_ratings_ticket_agent" UNIQUE ("ticketId", "agentId"),
                CONSTRAINT "CHK_agent_ratings_rating" CHECK ("rating" BETWEEN 1 AND 5),
                CONSTRAINT "FK_agent_ratings_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_agent_ratings_agent" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_agent_ratings_rater" FOREIGN KEY ("raterId") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_agent_ratings_agent_created" ON "agent_ratings" ("agentId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "agent_ratings"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_tickets_record_assignment" ON "tickets"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS record_ticket_assignment()`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_assignments"`);
        await queryRunner.query(`UPDATE "tickets" SET "status" = 'RESOLVED' WHERE "status" = 'CLOSED'`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "closedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "disputedAt"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN IF EXISTS "resolutionDeadlineAt"`);
        await this.recreateStatusEnum(queryRunner, STATUSES_BEFORE);
    }

    private async recreateStatusEnum(queryRunner: QueryRunner, values: string[]): Promise<void> {
        const list = values.map((v) => `'${v}'`).join(', ');
        await queryRunner.query(`ALTER TYPE "tickets_status_enum" RENAME TO "tickets_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "tickets_status_enum" AS ENUM (${list})`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(
            `ALTER TABLE "tickets" ALTER COLUMN "status" TYPE "tickets_status_enum" USING "status"::text::"tickets_status_enum"`,
        );
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'TODO'`);
        await queryRunner.query(`DROP TYPE "tickets_status_enum_old"`);
    }
}
