import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssigneeRolesToTicketModulesTable1790600000000 implements MigrationInterface {
    name = 'AddAssigneeRolesToTicketModulesTable1790600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add assignee_roles column
        await queryRunner.query(`
            ALTER TABLE "ticket_modules"
            ADD COLUMN IF NOT EXISTS "assignee_roles" character varying[] NOT NULL 
            DEFAULT ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN']::varchar[];
        `);

        // 2. Seed assignee_roles for standard modules
        await queryRunner.query(`
            UPDATE "ticket_modules"
            SET "assignee_roles" = ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN']::varchar[]
            WHERE "slug" = 'it-support';
        `);

        await queryRunner.query(`
            UPDATE "ticket_modules"
            SET "assignee_roles" = ARRAY['ADMIN', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV']::varchar[]
            WHERE "slug" IN ('oracle-k2', 'web-developer', 'mobile-developer');
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ticket_modules"
            DROP COLUMN IF EXISTS "assignee_roles";
        `);
    }
}
