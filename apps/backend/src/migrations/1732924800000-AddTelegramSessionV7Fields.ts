import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration for Telegram Bot V7 Redesign (Section 17.9)
 * Adds new fields to telegram_sessions table
 */
export class AddTelegramSessionV7Fields1732924800000 implements MigrationInterface {
    name = 'AddTelegramSessionV7Fields1732924800000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns for V7 redesign
        await queryRunner.query(`
            ALTER TABLE telegram_sessions 
            ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'id'
        `);

        await queryRunner.query(`
            ALTER TABLE telegram_sessions 
            ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true
        `);

        await queryRunner.query(`
            ALTER TABLE telegram_sessions 
            ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"notifyNewReply": true, "notifyStatusChange": true, "notifySlaWarning": true}'
        `);

        await queryRunner.query(`
            ALTER TABLE telegram_sessions 
            ADD COLUMN IF NOT EXISTS quick_replies JSONB DEFAULT '[]'
        `);

        await queryRunner.query(`
            ALTER TABLE telegram_sessions 
            ADD COLUMN IF NOT EXISTS tickets_created INTEGER DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE telegram_sessions 
            ADD COLUMN IF NOT EXISTS messages_count INTEGER DEFAULT 0
        `);

        // Add indexes for faster queries (17.9)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user_id 
            ON telegram_sessions(user_id)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_telegram_sessions_active_ticket 
            ON telegram_sessions(active_ticket_id)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_telegram_sessions_language 
            ON telegram_sessions(language)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_telegram_sessions_notifications 
            ON telegram_sessions(notifications_enabled)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove indexes
        await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_sessions_notifications`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_sessions_language`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_sessions_active_ticket`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_telegram_sessions_user_id`);

        // Remove columns
        await queryRunner.query(`ALTER TABLE telegram_sessions DROP COLUMN IF EXISTS messages_count`);
        await queryRunner.query(`ALTER TABLE telegram_sessions DROP COLUMN IF EXISTS tickets_created`);
        await queryRunner.query(`ALTER TABLE telegram_sessions DROP COLUMN IF EXISTS quick_replies`);
        await queryRunner.query(`ALTER TABLE telegram_sessions DROP COLUMN IF EXISTS preferences`);
        await queryRunner.query(`ALTER TABLE telegram_sessions DROP COLUMN IF EXISTS notifications_enabled`);
        await queryRunner.query(`ALTER TABLE telegram_sessions DROP COLUMN IF EXISTS language`);
    }
}
