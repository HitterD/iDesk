import { AppDataSource } from './src/data-source';

async function fix() {
    await AppDataSource.initialize();
    try {
        await AppDataSource.query(`INSERT INTO migrations (timestamp, name) VALUES (1732934400000, 'AddSlaEnhancementFields1732934400000')`);
        console.log("Migration skipped successfully.");
    } catch(e) {
        console.log("Already inserted or error: " + e.message);
    }
    await AppDataSource.destroy();
}
fix();
