import { AppDataSource } from './data-source';

async function syncDb() {
    try {
        await AppDataSource.initialize();
        console.log('Data Source has been initialized!');
        
        // This will force entity sync without using migrations
        await AppDataSource.synchronize(false);
        console.log('Database schema synchronized successfully.');
        
        process.exit(0);
    } catch (err) {
        console.error('Error during Data Source initialization', err);
        process.exit(1);
    }
}

syncDb();
