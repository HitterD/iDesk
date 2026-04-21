/**
 * Run after migration 1776000300000 to verify row counts match.
 * Usage: npx ts-node scripts/verify-hardware-migration.ts
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
    const ds = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_DATABASE ?? 'idesk_db',
    });
    await ds.initialize();

    const backupExists = await ds.query(
        `SELECT to_regclass('ict_budgets_backup_1776000299000') AS t`,
    );
    if (!backupExists[0]?.t) {
        console.error('FAIL: backup table ict_budgets_backup_1776000299000 not found');
        process.exit(1);
    }

    const [{ count: backupCount }] = await ds.query(
        `SELECT COUNT(*) FROM ict_budgets_backup_1776000299000`,
    );
    const [{ count: migratedCount }] = await ds.query(
        `SELECT COUNT(*) FROM hardware_requests WHERE request_number LIKE 'HR-%-9%'`,
    );

    console.log(`Backup rows:   ${backupCount}`);
    console.log(`Migrated rows: ${migratedCount}`);

    if (parseInt(migratedCount, 10) < parseInt(backupCount, 10)) {
        console.error(`FAIL: migrated (${migratedCount}) < backup (${backupCount})`);
        process.exit(1);
    }

    console.log('OK: migration row count verified');
    await ds.destroy();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
