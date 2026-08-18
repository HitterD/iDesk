import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { runSeed } from './initial-seed';
import { seedHardwareCatalog } from './hardware-catalog.seed';

// Load environment variables
config({ path: join(__dirname, '..', '..', '.env') });

// Create a DataSource for seeding
if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed is disabled in production');
}

const requiredDatabaseEnv = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'] as const;
for (const key of requiredDatabaseEnv) {
    if (!process.env[key]) throw new Error(`${key} is required for seeding`);
}

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [join(__dirname, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
    synchronize: true, // Only for development seeding
    logging: true,
});

async function main() {
    console.log('🔌 Connecting to database...');

    try {
        await AppDataSource.initialize();
        console.log('✅ Database connected!');

        await runSeed(AppDataSource);
        await seedHardwareCatalog(AppDataSource);

        await AppDataSource.destroy();
        console.log('🔌 Database connection closed.');

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

main();
