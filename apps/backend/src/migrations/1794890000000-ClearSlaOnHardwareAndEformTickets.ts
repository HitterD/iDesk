import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clears persisted SLA deadlines and breach flags on Hardware Request, E-Form Request,
 * and request_flows-backed tickets without deleting audit trails (sla_adjustments,
 * notifications, or ticket_messages).
 */
export class ClearSlaOnHardwareAndEformTickets1794890000000 implements MigrationInterface {
    name = 'ClearSlaOnHardwareAndEformTickets1794890000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "tickets"
            SET "slaTarget" = NULL,
                "originalSlaTarget" = NULL,
                "slaStartedAt" = NULL,
                "firstResponseTarget" = NULL,
                "slaRemainingMinutes" = NULL,
                "firstResponseRemainingMinutes" = NULL,
                "isOverdue" = false,
                "isFirstResponseBreached" = false,
                "slaWarningSent" = false
            WHERE (
                ("ticketType" IS NOT NULL AND "ticketType" IN ('HARDWARE_REQUEST', 'EFORM_REQUEST'))
                OR EXISTS (
                    SELECT 1 FROM "request_flows" rf
                    WHERE rf."ticketId" = "tickets"."id"
                )
            )
            AND (
                "slaTarget" IS NOT NULL
                OR "originalSlaTarget" IS NOT NULL
                OR "slaStartedAt" IS NOT NULL
                OR "firstResponseTarget" IS NOT NULL
                OR "slaRemainingMinutes" IS NOT NULL
                OR "firstResponseRemainingMinutes" IS NOT NULL
                OR "isOverdue" = true
                OR "isFirstResponseBreached" = true
                OR "slaWarningSent" = true
            )
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Intentional no-op: non-SLA Hardware and E-Form tickets never had valid SLA
        // deadlines, so reverting must not fabricate synthetic targets or breaches.
    }
}
