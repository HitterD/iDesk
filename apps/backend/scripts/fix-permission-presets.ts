import { DataSource } from 'typeorm';
import 'dotenv/config';

async function fixPermissionPresets() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'idesk_db',
    });

    try {
        await dataSource.initialize();
        console.log('Connected to database');

        // Check current columns
        const columns = await dataSource.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'permission_presets'
            ORDER BY ordinal_position;
        `);
        console.log('Current columns:', columns.map((c: any) => c.column_name).join(', '));

        // Add targetRole column if missing
        const hasTargetRole = columns.some((c: any) => c.column_name === 'targetRole');
        if (!hasTargetRole) {
            await dataSource.query(`
                ALTER TABLE permission_presets 
                ADD COLUMN IF NOT EXISTS "targetRole" varchar(20) DEFAULT 'AGENT';
            `);
            console.log('✅ Added: targetRole column with default AGENT');
        } else {
            console.log('ℹ️  targetRole column already exists');
        }

        // Add pageAccess column if missing
        const hasPageAccess = columns.some((c: any) => c.column_name === 'pageAccess');
        if (!hasPageAccess) {
            await dataSource.query(`
                ALTER TABLE permission_presets 
                ADD COLUMN IF NOT EXISTS "pageAccess" jsonb;
            `);
            console.log('✅ Added: pageAccess column');
        } else {
            console.log('ℹ️  pageAccess column already exists');
        }

        // Make permissions column nullable if needed
        const permissionsCol = columns.find((c: any) => c.column_name === 'permissions');
        if (permissionsCol && permissionsCol.is_nullable === 'NO') {
            await dataSource.query(`
                ALTER TABLE permission_presets 
                ALTER COLUMN permissions DROP NOT NULL;
            `);
            console.log('✅ Fixed: permissions column now allows NULL');
        } else {
            console.log('ℹ️  permissions column is already nullable');
        }

        await dataSource.destroy();
        console.log('\\n🎉 Database schema fixed successfully!');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

fixPermissionPresets();
