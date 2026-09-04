import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '..', '..', '.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: true,
});

async function main() {
    await AppDataSource.initialize();
    console.log('Updating hardware installation tickets to IN_PROGRESS...');
    const result = await AppDataSource.query(`
        UPDATE "tickets"
        SET "status" = 'IN_PROGRESS'
        WHERE "isHardwareInstallation" = true AND "status" != 'RESOLVED' AND "status" != 'CANCELLED';
    `);
    console.log('Result:', result);
    await AppDataSource.destroy();
}

main().catch(console.error);
