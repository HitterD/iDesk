import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Add GIN index for Full-Text Search on tickets
 * This migration adds a GIN index to support fast full-text search on title and description
 * 
 * Performance Impact:
 * - Before: ILIKE does sequential scan O(n)
 * - After: GIN index provides O(log n) lookups
 * - Expected improvement: ~10x for large datasets (1000+ tickets)
 */
export class AddFullTextSearchIndex1733750000000 implements MigrationInterface {
    name = 'AddFullTextSearchIndex1733750000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create GIN index for full-text search on tickets
        // Using 'indonesian' configuration for Indonesian language support
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_search_vector 
            ON tickets USING GIN (
                to_tsvector('indonesian', COALESCE(title, '') || ' ' || COALESCE(description, ''))
            )
        `);

        // Add index on assignedToId for agent stats queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id 
            ON tickets ("assignedToId")
        `);

        // Add composite index for SLA checker queries
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_sla_check 
            ON tickets (status, "isOverdue", "slaTarget", "slaStartedAt")
            WHERE status IN ('TODO', 'IN_PROGRESS')
        `);

        // Add index for first response SLA check
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_first_response_check 
            ON tickets ("firstResponseAt", "firstResponseTarget", "isFirstResponseBreached")
            WHERE "firstResponseAt" IS NULL AND "firstResponseTarget" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_first_response_check`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_sla_check`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_assigned_to_id`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_search_vector`);
    }
}
