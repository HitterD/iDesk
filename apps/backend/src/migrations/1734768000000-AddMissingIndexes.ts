import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add missing performance indexes identified in fullstack review
 * 
 * Indexes Added:
 * - idx_tickets_category: For category filter queries
 * - idx_notifications_category_date: For notification filtering by category and date
 * - idx_bookings_date_account: For Zoom booking calendar queries
 * - idx_audit_action_date: For audit log filtering
 */
export class AddMissingIndexes1734768000000 implements MigrationInterface {
    name = 'AddMissingIndexes1734768000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ticket category index
        await queryRunner.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_category 
            ON tickets(category)
        `);

        // Notifications category + date composite index
        await queryRunner.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_category_date 
            ON notifications(category, "createdAt" DESC)
        `);

        // Zoom bookings date + account composite index
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'zoom_bookings') THEN
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_date_account 
                    ON zoom_bookings("bookingDate", "zoomAccountId");
                END IF;
            END $$;
        `);

        // Audit logs action + date composite index
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_action_date 
                    ON audit_logs(action, "createdAt" DESC);
                END IF;
            END $$;
        `);

        // Renewal contracts vendor name index (for search)
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'renewal_contracts') THEN
                    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_vendor 
                    ON renewal_contracts("vendorName");
                END IF;
            END $$;
        `);

        console.log('✅ Missing indexes created successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_category`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_category_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_date_account`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_action_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_contracts_vendor`);

        console.log('Indexes dropped');
    }
}
