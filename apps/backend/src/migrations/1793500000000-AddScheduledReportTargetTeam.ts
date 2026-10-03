import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scheduled reports can target one team (IT Support, Oracle/K2, Web Dev,
 * Mobile Dev, or all Dev). Existing configs keep their old agent category:
 * REGULAR → OPS_SUPPORT, ORACLE → ORACLE_DEV; ALL/NULL stays all teams.
 */
export class AddScheduledReportTargetTeam1793500000000 implements MigrationInterface {
    name = 'AddScheduledReportTargetTeam1793500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scheduled_report_configs" ADD COLUMN IF NOT EXISTS "targetTeam" varchar(12) NULL`);
        await queryRunner.query(`
            UPDATE "scheduled_report_configs"
            SET "targetTeam" = CASE "targetAgentCategory"::text
                WHEN 'REGULAR' THEN 'OPS_SUPPORT'
                WHEN 'ORACLE' THEN 'ORACLE_DEV'
            END
            WHERE "targetTeam" IS NULL AND "targetAgentCategory" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scheduled_report_configs" DROP COLUMN IF EXISTS "targetTeam"`);
    }
}
