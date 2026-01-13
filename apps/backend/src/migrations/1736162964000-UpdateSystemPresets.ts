import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateSystemPresets1736162964000 implements MigrationInterface {
    name = 'UpdateSystemPresets1736162964000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update User preset
        await queryRunner.query(`
            UPDATE "permission_presets" 
            SET 
                "targetRole" = 'USER',
                "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "knowledge_base": true, "notifications": true}'::jsonb
            WHERE "name" = 'User' AND "isSystem" = true
        `);

        // Update Agent preset
        await queryRunner.query(`
            UPDATE "permission_presets" 
            SET 
                "targetRole" = 'AGENT',
                "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "knowledge_base": true, "notifications": true, "reports": true, "renewal": true}'::jsonb
            WHERE "name" = 'Agent' AND "isSystem" = true
        `);

        // Update Manager preset
        await queryRunner.query(`
            UPDATE "permission_presets" 
            SET 
                "targetRole" = 'MANAGER',
                "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "reports": true, "knowledge_base": true}'::jsonb
            WHERE "name" = 'Manager' AND "isSystem" = true
        `);

        // Update Admin preset
        await queryRunner.query(`
            UPDATE "permission_presets" 
            SET 
                "targetRole" = 'ADMIN',
                "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "knowledge_base": true, "notifications": true, "reports": true, "renewal": true, "agents": true, "automation": true, "audit_logs": true, "system_health": true, "settings": true}'::jsonb
            WHERE "name" = 'Admin' AND "isSystem" = true
        `);

        // Log migration result
        console.log('[Migration] Updated system presets with targetRole and pageAccess');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback: Reset to default USER and NULL pageAccess
        await queryRunner.query(`
            UPDATE "permission_presets" 
            SET 
                "targetRole" = 'USER',
                "pageAccess" = NULL
            WHERE "isSystem" = true
        `);

        console.log('[Migration] Rolled back system presets to default');
    }
}
