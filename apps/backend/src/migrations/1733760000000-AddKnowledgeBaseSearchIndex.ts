import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Add GIN index for Full-Text Search on Knowledge Base articles
 * 
 * Performance Impact:
 * - Before: ILIKE does sequential scan O(n)
 * - After: GIN index provides O(log n) lookups
 * - Expected improvement: ~10x for large datasets (1000+ articles)
 */
export class AddKnowledgeBaseSearchIndex1733760000000 implements MigrationInterface {
    name = 'AddKnowledgeBaseSearchIndex1733760000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create GIN index for full-text search on articles
        // Using 'indonesian' configuration for Indonesian language support
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_articles_search_vector 
            ON articles USING GIN (
                to_tsvector('indonesian', COALESCE(title, '') || ' ' || COALESCE(content, ''))
            )
        `);

        // Add index on status for filtered queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_articles_status 
            ON articles (status)
        `);

        // Add index on category for filtered queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_articles_category 
            ON articles (category)
        `);

        // Add composite index for popular/recent articles
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_articles_popular 
            ON articles (status, "viewCount" DESC)
            WHERE status = 'PUBLISHED'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_popular`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_category`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_status`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_articles_search_vector`);
    }
}
