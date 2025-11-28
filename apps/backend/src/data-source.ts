import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config();

/**
 * TypeORM Data Source for CLI migrations
 * 
 * Usage:
 *   npm run migration:generate -- -n MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'idesk_db',
    entities: [join(__dirname, '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false, // Never use in production
    logging: process.env.DB_LOGGING === 'true',
});
