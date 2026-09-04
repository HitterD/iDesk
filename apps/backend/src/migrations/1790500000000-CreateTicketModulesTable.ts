import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTicketModulesTable1790500000000 implements MigrationInterface {
    name = 'CreateTicketModulesTable1790500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create ticket_modules table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ticket_modules" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "slug" character varying(100) NOT NULL,
                "description" text,
                "icon" character varying(50) NOT NULL DEFAULT 'Ticket',
                "color" character varying(30) NOT NULL DEFAULT 'blue',
                "sortOrder" integer NOT NULL DEFAULT 0,
                "isActive" boolean NOT NULL DEFAULT true,
                "isSystem" boolean NOT NULL DEFAULT false,
                "handlingTeams" character varying[] NOT NULL DEFAULT ARRAY['OPS_SUPPORT']::varchar[],
                "categories" character varying[] NOT NULL DEFAULT ARRAY[]::varchar[],
                "ticketTypes" character varying[] NOT NULL DEFAULT ARRAY[]::varchar[],
                "allowedRoles" character varying[] NOT NULL DEFAULT ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN', 'MANAGER']::varchar[],
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ticket_modules" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_ticket_modules_slug" UNIQUE ("slug")
            )
        `);

        // 2. Seed default system modules if not exist
        await queryRunner.query(`
            INSERT INTO "ticket_modules" ("name", "slug", "description", "icon", "color", "sortOrder", "isActive", "isSystem", "handlingTeams", "categories", "ticketTypes", "allowedRoles")
            VALUES 
            (
                'IT Support Tickets',
                'it-support',
                'General IT Support ticketing queue for operational support',
                'Ticket',
                'blue',
                1,
                true,
                true,
                ARRAY['OPS_SUPPORT']::varchar[],
                ARRAY[]::varchar[],
                ARRAY[]::varchar[],
                ARRAY['ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ADMIN', 'MANAGER']::varchar[]
            ),
            (
                'Oracle K2 Request',
                'oracle-k2',
                'Oracle Database & K2 Workflow system development requests',
                'Database',
                'purple',
                2,
                true,
                true,
                ARRAY['ORACLE_DEV']::varchar[],
                ARRAY['Oracle', 'K2', 'Oracle / K2', 'Oracle/K2']::varchar[],
                ARRAY['ORACLE_REQUEST']::varchar[],
                ARRAY['ADMIN', 'AGENT_ORACLE', 'AGENT_MOBILE_DEV', 'AGENT_WEB_DEV']::varchar[]
            ),
            (
                'Web Developer Request',
                'web-developer',
                'Website, Portal, and Backend API development requests',
                'Code2',
                'sky',
                3,
                true,
                true,
                ARRAY['WEB_DEV']::varchar[],
                ARRAY['Website', 'Web', 'Web Developer', 'API', 'API / Backend', 'Portal', 'Frontend']::varchar[],
                ARRAY['WEB_DEV_REQUEST']::varchar[],
                ARRAY['ADMIN', 'AGENT_ORACLE', 'AGENT_MOBILE_DEV', 'AGENT_WEB_DEV']::varchar[]
            ),
            (
                'Mobile Developer Request',
                'mobile-developer',
                'Android, iOS, and Flutter mobile applications development requests',
                'Smartphone',
                'emerald',
                4,
                true,
                true,
                ARRAY['MOBILE_DEV']::varchar[],
                ARRAY['Mobile Developer', 'Mobile App', 'Android', 'iOS', 'Flutter']::varchar[],
                ARRAY['MOBILE_DEV_REQUEST']::varchar[],
                ARRAY['ADMIN', 'AGENT_MOBILE_DEV', 'AGENT_ORACLE', 'AGENT_WEB_DEV']::varchar[]
            )
            ON CONFLICT ("slug") DO NOTHING;
        `);

        // 3. Fix handlingTeam for existing tickets that are web/api/mobile/oracle
        await queryRunner.query(`
            UPDATE "tickets"
            SET "handlingTeam" = 'WEB_DEV'
            WHERE ("category" ILIKE '%web%' OR "category" ILIKE '%api%' OR "category" ILIKE '%site%' OR "title" ILIKE '%website%' OR "title" ILIKE '%api%')
            AND ("handlingTeam" IS NULL OR "handlingTeam" = 'OPS_SUPPORT');
        `);

        await queryRunner.query(`
            UPDATE "tickets"
            SET "handlingTeam" = 'MOBILE_DEV'
            WHERE ("category" ILIKE '%mobile%' OR "category" ILIKE '%android%' OR "category" ILIKE '%ios%' OR "title" ILIKE '%mobile%' OR "title" ILIKE '%android%')
            AND ("handlingTeam" IS NULL OR "handlingTeam" = 'OPS_SUPPORT');
        `);

        await queryRunner.query(`
            UPDATE "tickets"
            SET "handlingTeam" = 'ORACLE_DEV'
            WHERE ("category" ILIKE '%oracle%' OR "category" ILIKE '%k2%' OR "title" ILIKE '%oracle%' OR "title" ILIKE '%k2%')
            AND ("handlingTeam" IS NULL OR "handlingTeam" = 'OPS_SUPPORT');
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "ticket_modules"`);
    }
}
