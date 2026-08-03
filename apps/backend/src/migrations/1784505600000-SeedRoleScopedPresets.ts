import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRoleScopedPresets1784505600000 implements MigrationInterface {
    name = 'SeedRoleScopedPresets1784505600000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "permission_presets"
            SET "pageAccess" = jsonb_set(
                COALESCE("pageAccess", '{}'::jsonb),
                '{zoom_calendar}',
                'false'::jsonb,
                true
            )
            WHERE "name" = 'User' AND "isSystem" = true
        `);

        await queryRunner.query(`
            INSERT INTO "permission_presets" (
                "name", "description", "targetRole", "pageAccess", "permissions",
                "isDefault", "sortOrder", "isActive", "isSystem"
            )
            SELECT
                'User Zoom',
                'Standard user with Zoom Calendar access.',
                'USER',
                jsonb_set(COALESCE("pageAccess", '{}'::jsonb), '{zoom_calendar}', 'true'::jsonb, true),
                "permissions",
                false,
                2,
                true,
                true
            FROM "permission_presets"
            WHERE "name" = 'User' AND "isSystem" = true
              AND NOT EXISTS (
                SELECT 1 FROM "permission_presets"
                WHERE "name" = 'User Zoom' AND "isSystem" = true
              )
        `);

        await queryRunner.query(`
            INSERT INTO "permission_presets" (
                "name", "description", "targetRole", "pageAccess", "permissions",
                "isDefault", "sortOrder", "isActive", "isSystem"
            )
            SELECT
                'Agent Operational Support',
                'Operational support agent. Same page and ticket access as Agent.',
                'AGENT',
                "pageAccess",
                "permissions",
                false,
                4,
                true,
                true
            FROM "permission_presets"
            WHERE "name" = 'Agent' AND "isSystem" = true
              AND NOT EXISTS (
                SELECT 1 FROM "permission_presets"
                WHERE "name" = 'Agent Operational Support' AND "isSystem" = true
              )
        `);

        await queryRunner.query(`
            INSERT INTO "permission_presets" (
                "name", "description", "targetRole", "pageAccess", "permissions",
                "isDefault", "sortOrder", "isActive", "isSystem"
            )
            SELECT
                'Agent Oracle',
                'Oracle/K2 agent. Oracle/K2 ticket queue and notifications only.',
                'AGENT',
                '{"oracle_k2_tickets": true, "notifications": true}'::jsonb,
                '{"ticketing.view":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.create":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.edit":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.manage":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"ticketing.assign":{"canView":true,"canCreate":true,"canEdit":true,"canDelete":false},"notifications.view":{"canView":true,"canCreate":false,"canEdit":false,"canDelete":false}}'::jsonb,
                false,
                5,
                true,
                true
            WHERE NOT EXISTS (
                SELECT 1 FROM "permission_presets"
                WHERE "name" = 'Agent Oracle' AND "isSystem" = true
            )
        `);

        await queryRunner.query(`
            UPDATE "users" AS user_record
            SET
                "appliedPresetId" = preset.id,
                "appliedPresetName" = preset.name
            FROM "permission_presets" AS preset
            WHERE user_record."appliedPresetId" IS NULL
              AND preset."isSystem" = true
              AND preset."isActive" = true
              AND preset.name = CASE user_record.role::text
                WHEN 'USER' THEN 'User'
                WHEN 'AGENT' THEN 'Agent'
                WHEN 'AGENT_ADMIN' THEN 'Agent'
                WHEN 'AGENT_OPERATIONAL_SUPPORT' THEN 'Agent Operational Support'
                WHEN 'AGENT_ORACLE' THEN 'Agent Oracle'
                WHEN 'MANAGER' THEN 'Manager'
                WHEN 'ADMIN' THEN 'Admin'
              END
        `);

        await queryRunner.query(`
            UPDATE "users" AS user_record
            SET "appliedPresetName" = preset.name
            FROM "permission_presets" AS preset
            WHERE user_record."appliedPresetId" = preset.id
              AND user_record."appliedPresetName" IS NULL
        `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "permission_presets" AS preset
            WHERE preset."name" IN ('User Zoom', 'Agent Operational Support', 'Agent Oracle')
              AND preset."isSystem" = true
              AND NOT EXISTS (
                SELECT 1 FROM "users" WHERE "appliedPresetId" = preset.id
              )
        `);
    }
}
