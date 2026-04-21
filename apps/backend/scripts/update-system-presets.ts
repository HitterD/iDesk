// scripts/update-system-presets.ts
// Direct SQL execution to update system presets with targetRole and pageAccess
// Run with: npx ts-node -r tsconfig-paths/register scripts/update-system-presets.ts

import { AppDataSource as dataSource } from '../src/data-source';

async function main() {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Connected!\n');

    console.log('Updating system presets...\n');

    // Update User preset
    const userResult = await dataSource.query(`
        UPDATE permission_presets 
        SET "targetRole" = 'USER',
            "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "knowledge_base": true, "notifications": true, "hardware_requests": true, "eform_access": true, "lost_items": true}'::jsonb
        WHERE name = 'User' AND "isSystem" = true
        RETURNING name, "targetRole"
    `);
    console.log('✓ Updated User preset:', userResult);

    // Update Agent preset
    const agentResult = await dataSource.query(`
        UPDATE permission_presets 
        SET "targetRole" = 'AGENT',
            "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "knowledge_base": true, "notifications": true, "reports": true, "renewal": true, "hardware_requests": true, "eform_access": true, "lost_items": true}'::jsonb
        WHERE name = 'Agent' AND "isSystem" = true
        RETURNING name, "targetRole"
    `);
    console.log('✓ Updated Agent preset:', agentResult);

    // Update Manager preset
    const managerResult = await dataSource.query(`
        UPDATE permission_presets 
        SET "targetRole" = 'MANAGER',
            "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "reports": true, "knowledge_base": true, "hardware_requests": true, "eform_access": true, "lost_items": true, "renewal": true, "workloads": true}'::jsonb
        WHERE name = 'Manager' AND "isSystem" = true
        RETURNING name, "targetRole"
    `);
    console.log('✓ Updated Manager preset:', managerResult);

    // Update Admin preset
    const adminResult = await dataSource.query(`
        UPDATE permission_presets 
        SET "targetRole" = 'ADMIN',
            "pageAccess" = '{"dashboard": true, "tickets": true, "zoom_calendar": true, "knowledge_base": true, "notifications": true, "reports": true, "renewal": true, "agents": true, "automation": true, "audit_logs": true, "system_health": true, "settings": true, "hardware_requests": true, "eform_access": true, "lost_items": true, "workloads": true}'::jsonb
        WHERE name = 'Admin' AND "isSystem" = true
        RETURNING name, "targetRole"
    `);
    console.log('✓ Updated Admin preset:', adminResult);

    // Verification
    console.log('\n=== Verification ===');
    const allPresets = await dataSource.query(`
        SELECT name, "targetRole", "pageAccess" 
        FROM permission_presets 
        WHERE "isSystem" = true 
        ORDER BY "sortOrder"
    `);

    for (const preset of allPresets) {
        const pageCount = preset.pageAccess ? Object.keys(preset.pageAccess).length : 0;
        console.log(`${preset.name}: targetRole=${preset.targetRole}, pages=${pageCount}`);
    }

    await dataSource.destroy();
    console.log('\n✅ Migration complete!');
}

main().catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
