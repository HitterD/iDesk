import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add notification center enhancements (Section 6)
 * 
 * Changes:
 * 1. Add category and reference_id to notifications table
 * 2. Add D-60 reminder and acknowledge fields to renewal_contracts table
 */
export class AddNotificationCenterEnhancements1732883100000 implements MigrationInterface {
    name = 'AddNotificationCenterEnhancements1732883100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Create notification category enum if not exists
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE notification_category_enum AS ENUM ('CATEGORY_TICKET', 'CATEGORY_RENEWAL');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Step 2: Add category column to notifications table (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE notifications 
                ADD COLUMN category notification_category_enum DEFAULT 'CATEGORY_TICKET';
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);

        // Step 3: Add reference_id column to notifications table (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE notifications 
                ADD COLUMN "referenceId" UUID;
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);

        // Step 4: Create indexes for notifications table
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
        `);
        
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications("referenceId");
        `);

        // Step 5: Add D-60 reminder field to renewal_contracts (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE renewal_contracts 
                ADD COLUMN "reminderD60Sent" BOOLEAN DEFAULT false;
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);

        // Step 6: Add acknowledge fields to renewal_contracts (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE renewal_contracts 
                ADD COLUMN "isAcknowledged" BOOLEAN DEFAULT false;
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE renewal_contracts 
                ADD COLUMN "acknowledgedAt" TIMESTAMP;
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE renewal_contracts 
                ADD COLUMN "acknowledgedById" UUID REFERENCES users(id);
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);

        // Step 7: Backfill existing notifications with default category
        await queryRunner.query(`
            UPDATE notifications 
            SET category = 'CATEGORY_TICKET' 
            WHERE category IS NULL;
        `);

        // Step 8: Add new notification types to enum (if not exists)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'RENEWAL_D60_WARNING';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'RENEWAL_D30_WARNING';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'RENEWAL_D7_WARNING';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'RENEWAL_D1_WARNING';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'RENEWAL_EXPIRED';
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_category;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_reference;`);

        // Remove renewal_contracts columns
        await queryRunner.query(`ALTER TABLE renewal_contracts DROP COLUMN IF EXISTS "acknowledgedById";`);
        await queryRunner.query(`ALTER TABLE renewal_contracts DROP COLUMN IF EXISTS "acknowledgedAt";`);
        await queryRunner.query(`ALTER TABLE renewal_contracts DROP COLUMN IF EXISTS "isAcknowledged";`);
        await queryRunner.query(`ALTER TABLE renewal_contracts DROP COLUMN IF EXISTS "reminderD60Sent";`);

        // Remove notifications columns
        await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS "referenceId";`);
        await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS category;`);

        // Note: Dropping enum types and values is complex and may affect data
        // In production, consider keeping the enum changes
    }
}
