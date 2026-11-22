import { MigrationInterface, QueryRunner } from 'typeorm';
import { backfillRequestFlows } from '../modules/request-flow/services/request-flow-backfill';

/** Every ticket type as of this migration (frozen: later additions belong to their own migration). */
const TICKET_TYPES = [
    'SERVICE', 'ICT_BUDGET', 'LOST_ITEM', 'ACCESS_REQUEST', 'HARDWARE_INSTALLATION', 'ORACLE_REQUEST',
    'WEB_DEV_REQUEST', 'MOBILE_DEV_REQUEST', 'HARDWARE_REQUEST', 'EFORM_REQUEST',
];

/**
 * Backfills a parent ticket + request flow for every existing hardware / e-form request (see `backfillRequestFlows`).
 *
 * 1794800000000 added HARDWARE_REQUEST / EFORM_REQUEST with `ALTER TYPE ... ADD VALUE`. TypeORM runs pending
 * migrations in one transaction and Postgres forbids using a value added in the same transaction, so the enum is
 * recreated here first (as in 1792800000000); a freshly created type's values are usable at once.
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
        const list = TICKET_TYPES.map((v) => `'${v}'`).join(', ');
        await queryRunner.query(`ALTER TYPE "tickets_tickettype_enum" RENAME TO "tickets_tickettype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "tickets_tickettype_enum" AS ENUM (${list})`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "ticketType" DROP DEFAULT`);
        await queryRunner.query(
            `ALTER TABLE "tickets" ALTER COLUMN "ticketType" TYPE "tickets_tickettype_enum" USING "ticketType"::text::"tickets_tickettype_enum"`,
        );
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "ticketType" SET DEFAULT 'SERVICE'`);
        await queryRunner.query(`DROP TYPE "tickets_tickettype_enum_old"`);
    }
}
