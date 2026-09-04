import { AppDataSource } from '../src/data-source';

async function applySavedRepliesSchema() {
    try {
        console.log('Connecting to database...');
        await AppDataSource.initialize();
        console.log('Connected.');

        console.log('Adding shortcut column to saved_replies...');
        await AppDataSource.query(`ALTER TABLE "saved_replies" ADD COLUMN IF NOT EXISTS "shortcut" VARCHAR`);

        console.log('Adding category column to saved_replies...');
        await AppDataSource.query(`ALTER TABLE "saved_replies" ADD COLUMN IF NOT EXISTS "category" VARCHAR DEFAULT 'General'`);

        console.log('Adding index on userId...');
        await AppDataSource.query(`CREATE INDEX IF NOT EXISTS "idx_saved_replies_user_id" ON "saved_replies" ("userId")`);

        console.log('Schema migration for saved_replies applied successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error applying saved_replies schema:', err);
        process.exit(1);
    }
}

applySavedRepliesSchema();
