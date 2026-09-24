import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExcludeAdminFromWorkloadAndAutoAssign1791600000000 implements MigrationInterface {
    name = 'ExcludeAdminFromWorkloadAndAutoAssign1791600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Delete historical workload entries for users with ADMIN or AGENT_ADMIN role
        await queryRunner.query(`
            DELETE FROM "agent_daily_workload"
            WHERE "agentId" IN (
                SELECT id FROM "users" WHERE "role" IN ('ADMIN', 'AGENT_ADMIN')
            );
        `);

        // 2. Remove ADMIN and AGENT_ADMIN from assignee_roles in ticket_modules
        await queryRunner.query(`
            UPDATE "ticket_modules"
            SET "assignee_roles" = array_remove(array_remove("assignee_roles", 'ADMIN'), 'AGENT_ADMIN')
            WHERE "assignee_roles" IS NOT NULL;
        `);

        // 3. Update default value of assignee_roles column
        await queryRunner.query(`
            ALTER TABLE "ticket_modules"
            ALTER COLUMN "assignee_roles" SET DEFAULT ARRAY['AGENT', 'AGENT_OPERATIONAL_SUPPORT']::varchar[];
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ticket_modules"
            ALTER COLUMN "assignee_roles" SET DEFAULT ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN']::varchar[];
        `);
    }
}
