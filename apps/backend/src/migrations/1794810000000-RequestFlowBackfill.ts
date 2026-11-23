import { MigrationInterface, QueryRunner } from 'typeorm';
import { backfillRequestFlows } from '../modules/request-flow/services/request-flow-backfill';

const TICKET_TYPE_ENUM = 'tickets_tickettype_enum';

/** Current values of the ticket type enum in their declared order, including values ADDed earlier in this transaction. */
export const SELECT_TICKET_TYPES = `SELECT enumlabel FROM pg_enum WHERE enumtypid = '"${TICKET_TYPE_ENUM}"'::regtype ORDER BY enumsortorder`;

/** The column-type change rewrites the whole tickets table; the pool's 15 s statement_timeout must not cut it off. */
export const DISABLE_STATEMENT_TIMEOUT = 'SET LOCAL statement_timeout = 0';

/**
 * Backfills a parent ticket + request flow for every existing hardware / e-form request (see `backfillRequestFlows`).
 *
 * 1794800000000 added HARDWARE_REQUEST / EFORM_REQUEST with `ALTER TYPE ... ADD VALUE`. TypeORM runs pending
 * migrations in one transaction and Postgres forbids using a value added in the same transaction, so the enum is
 * recreated here first (as in 1792800000000); a freshly created type's values are usable at once. The value list is
 * read from pg_enum so the original values and their order are kept exactly.
 */
export class RequestFlowBackfill1794810000000 implements MigrationInterface {
    name = 'RequestFlowBackfill1794810000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.recreateTicketTypeEnum(queryRunner);
        await backfillRequestFlows(queryRunner.manager);
    }

    public async down(): Promise<void> {
        // No-op: the created tickets and flows are real data now (chat, status, links); they are not deleted.
    }

    private async recreateTicketTypeEnum(queryRunner: QueryRunner): Promise<void> {
        const rows: { enumlabel: string }[] = await queryRunner.query(SELECT_TICKET_TYPES);
        if (rows.length === 0) throw new Error(`Enum "${TICKET_TYPE_ENUM}" has no values`);
        const list = rows.map((r) => `'${r.enumlabel.replace(/'/g, "''")}'`).join(', ');
        await queryRunner.query(DISABLE_STATEMENT_TIMEOUT);
        await queryRunner.query(`ALTER TYPE "${TICKET_TYPE_ENUM}" RENAME TO "${TICKET_TYPE_ENUM}_old"`);
        await queryRunner.query(`CREATE TYPE "${TICKET_TYPE_ENUM}" AS ENUM (${list})`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "ticketType" DROP DEFAULT`);
        await queryRunner.query(
            `ALTER TABLE "tickets" ALTER COLUMN "ticketType" TYPE "${TICKET_TYPE_ENUM}" USING "ticketType"::text::"${TICKET_TYPE_ENUM}"`,
        );
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "ticketType" SET DEFAULT 'SERVICE'`);
        await queryRunner.query(`DROP TYPE "${TICKET_TYPE_ENUM}_old"`);
    }
}
