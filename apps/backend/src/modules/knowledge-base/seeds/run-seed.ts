import { DataSource } from 'typeorm';
import { Article } from '../entities/article.entity';
import { ArticleView } from '../entities/article-view.entity';
import { seedKBArticles } from './kb-articles.seed';

const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'idesk_db',
    entities: [Article, ArticleView],
    synchronize: false,
});

async function runSeed() {
    try {
        console.log('🔌 Connecting to database...');
        await dataSource.initialize();
        console.log('✅ Database connected!\n');

        console.log('📝 Seeding KB Articles...\n');
        await seedKBArticles(dataSource);

        await dataSource.destroy();
        console.log('\n✅ Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error running seed:', error);
        process.exit(1);
    }
}

runSeed();
