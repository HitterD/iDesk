import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remembers the team a ticket was last forwarded from, so lists and the TV board can tag it
 * "Diteruskan dari <tim>". Older forwards are filled once from their system note
 * ("Ticket forwarded from <TEAM> to <TEAM> ..."), newest note per ticket; nothing else is touched.
 */
export class AddTicketForwardedFrom1794180000000 implements MigrationInterface {
    name = 'AddTicketForwardedFrom1794180000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets"
            ADD COLUMN IF NOT EXISTS "forwardedFromTeam" varchar(20) NULL,
            ADD COLUMN IF NOT EXISTS "forwardedAt" timestamp NULL,
            ADD COLUMN IF NOT EXISTS "forwardedById" uuid NULL`);
        await queryRunner.query(`UPDATE "tickets" t
            SET "forwardedFromTeam" = f.from_team, "forwardedAt" = f.at
            FROM (
                SELECT DISTINCT ON (m."ticketId") m."ticketId" AS ticket_id,
                       substring(m.content from 'Ticket forwarded from ([A-Z_]+) to') AS from_team,
                       m."createdAt" AS at
                FROM "ticket_messages" m
                WHERE m."isSystemMessage" = true AND m.content LIKE 'Ticket forwarded from %'
                ORDER BY m."ticketId", m."createdAt" DESC
            ) f
            WHERE t.id = f.ticket_id AND t."forwardedFromTeam" IS NULL AND f.from_team IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets"
            DROP COLUMN IF EXISTS "forwardedById",
            DROP COLUMN IF EXISTS "forwardedAt",
            DROP COLUMN IF EXISTS "forwardedFromTeam"`);
    }
}
