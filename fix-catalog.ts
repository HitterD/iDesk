import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { HardwareCatalog } from './apps/backend/src/modules/hardware-request/domain/entities/hardware-catalog.entity';
import * as dotenv from 'dotenv';
dotenv.config({ path: './apps/backend/.env' });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'idesk_usr',
    password: process.env.DB_PASSWORD || 'idesk_pwd',
    database: process.env.DB_DATABASE || 'idesk_db',
    entities: [HardwareCatalog],
    synchronize: false,
});

async function run() {
    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository(HardwareCatalog);
    
    // Hard delete LAPTOP-i5 and LAPTOP-i3
    const deleted = await repo.delete({ code: ['LAPTOP-i5', 'LAPTOP-i3'] });
    console.log(`Deleted rows: ${deleted.affected}`);
    
    // Alternatively, hard delete ALL inactive catalogs if they want ALL soft-deleted to be hard deleted
    const allInactive = await repo.delete({ active: false });
    console.log(`Deleted inactive rows: ${allInactive.affected}`);
    
    await AppDataSource.destroy();
}
run().catch(console.error);
