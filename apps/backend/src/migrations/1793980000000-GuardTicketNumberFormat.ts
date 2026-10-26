import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rejects malformed ticket numbers at write time. A division with a space ("261026-HC -0013") was invisible to the
 * generator's sequence read, so the next ticket reused it and creation failed with "already exists" until midnight.
 *
 * A trigger, not a CHECK constraint: legacy malformed numbers stay (iPop and partner apps look tickets up by them),
 * and Postgres re-checks a CHECK on every UPDATE of the row, which would lock those tickets. The trigger only fires
 * when a number is inserted or changed.
 */
export class GuardTicketNumberFormat1793980000000 implements MigrationInterface {
    name = 'GuardTicketNumberFormat1793980000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION tickets_guard_ticket_number() RETURNS trigger AS $$
            BEGIN
                IF NEW."ticketNumber" IS NULL
                   OR (TG_OP = 'UPDATE' AND NEW."ticketNumber" IS NOT DISTINCT FROM OLD."ticketNumber") THEN
                    RETURN NEW;
                END IF;
                IF NEW."ticketNumber" !~ '^[0-9]{6}-[A-Z0-9]+-[0-9]{4,}$' THEN
                    RAISE EXCEPTION 'Invalid ticket number format: "%"', NEW."ticketNumber" USING ERRCODE = 'check_violation';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_tickets_guard_ticket_number" ON "tickets"`);
        await queryRunner.query(`
            CREATE TRIGGER "TRG_tickets_guard_ticket_number"
            BEFORE INSERT OR UPDATE OF "ticketNumber" ON "tickets"
            FOR EACH ROW EXECUTE FUNCTION tickets_guard_ticket_number()
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_tickets_guard_ticket_number" ON "tickets"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS tickets_guard_ticket_number()`);
    }
}
