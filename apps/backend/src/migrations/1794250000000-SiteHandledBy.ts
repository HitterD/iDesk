import { MigrationInterface, QueryRunner } from 'typeorm';

/** Join that matches only when both Sukodono and Sepanjang exist; ids differ per database, so look them up by code. */
const SKD_AND_SPJ = `"sites" skd, "sites" spj WHERE skd."code" = 'SKD' AND spj."code" = 'SPJ'`;

/**
 * Additive: a site may hand its ICT requests to another site (Sukodono → Sepanjang).
 * Requests already filed under Sukodono move to Sepanjang so its ICT sees and handles them.
 */
export class SiteHandledBy1794250000000 implements MigrationInterface {
    name = 'SiteHandledBy1794250000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "handledBySiteId" uuid NULL
            REFERENCES "sites"("id") ON DELETE SET NULL`);
        await queryRunner.query(`UPDATE "sites" SET "handledBySiteId" = (SELECT "id" FROM "sites" WHERE "code" = 'SPJ')
            WHERE "code" = 'SKD' AND EXISTS (SELECT 1 FROM "sites" WHERE "code" = 'SPJ')`);

        await queryRunner.query(`UPDATE "tickets" t SET "siteId" = spj."id" FROM ${SKD_AND_SPJ} AND t."siteId" = skd."id"`);
        await queryRunner.query(`UPDATE "hardware_requests" r SET "siteId" = spj."id" FROM ${SKD_AND_SPJ} AND r."siteId" = skd."id"`);
        // eform_requests."siteId" is varchar.
        await queryRunner.query(`UPDATE "eform_requests" e SET "siteId" = spj."id"::text FROM ${SKD_AND_SPJ} AND e."siteId" = skd."id"::text`);
        // Merge matching agent/day rows before moving the rest; stale SKD rows must not remain in global summaries.
        await queryRunner.query(`UPDATE "agent_daily_workload" target SET
            "totalPoints" = target."totalPoints" + source."totalPoints",
            "activeTickets" = target."activeTickets" + source."activeTickets",
            "resolvedTickets" = target."resolvedTickets" + source."resolvedTickets",
            "lastAssignedAt" = GREATEST(target."lastAssignedAt", source."lastAssignedAt")
            FROM "agent_daily_workload" source, ${SKD_AND_SPJ}
                AND source."siteId" = skd."id" AND target."siteId" = spj."id"
                AND source."agentId" = target."agentId" AND source."workDate" = target."workDate"`);
        await queryRunner.query(`DELETE FROM "agent_daily_workload" source USING ${SKD_AND_SPJ}
            AND source."siteId" = skd."id" AND EXISTS (SELECT 1 FROM "agent_daily_workload" target
                WHERE target."siteId" = spj."id" AND target."agentId" = source."agentId" AND target."workDate" = source."workDate")`);
        await queryRunner.query(`UPDATE "agent_daily_workload" w SET "siteId" = spj."id" FROM ${SKD_AND_SPJ} AND w."siteId" = skd."id"`);
    }

    /**
     * Drops the column only. Moved requests stay with Sepanjang: after up() they may have been worked on there,
     * and nothing records which ones were Sukodono's, so moving them back would guess.
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "handledBySiteId"`);
    }
}
