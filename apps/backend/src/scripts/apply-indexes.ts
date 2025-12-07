/**
 * Script to apply missing database indexes
 * Run with: npx ts-node src/scripts/apply-indexes.ts
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function applyIndexes() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'idesk_db',
    });

    try {
        await client.connect();
        console.log('✓ Connected to database\n');

        const indexes = [
            { name: 'IDX_user_role', sql: 'CREATE INDEX IF NOT EXISTS "IDX_user_role" ON "users" ("role")' },
            { name: 'IDX_user_isActive', sql: 'CREATE INDEX IF NOT EXISTS "IDX_user_isActive" ON "users" ("isActive")' },
            { name: 'IDX_ticketmsg_ticketId', sql: 'CREATE INDEX IF NOT EXISTS "IDX_ticketmsg_ticketId" ON "ticket_messages" ("ticketId")' },
            { name: 'IDX_ticketmsg_ticketId_createdAt', sql: 'CREATE INDEX IF NOT EXISTS "IDX_ticketmsg_ticketId_createdAt" ON "ticket_messages" ("ticketId", "createdAt")' },
            { name: 'IDX_notification_userId_isRead', sql: 'CREATE INDEX IF NOT EXISTS "IDX_notification_userId_isRead" ON "notifications" ("userId", "isRead")' },
            { name: 'IDX_notification_userId_createdAt', sql: 'CREATE INDEX IF NOT EXISTS "IDX_notification_userId_createdAt" ON "notifications" ("userId", "createdAt")' },
            { name: 'IDX_article_status', sql: 'CREATE INDEX IF NOT EXISTS "IDX_article_status" ON "articles" ("status")' },
            { name: 'IDX_article_status_visibility', sql: 'CREATE INDEX IF NOT EXISTS "IDX_article_status_visibility" ON "articles" ("status", "visibility")' },
            { name: 'IDX_article_category', sql: 'CREATE INDEX IF NOT EXISTS "IDX_article_category" ON "articles" ("category")' },
            { name: 'IDX_workflowrule_isActive_priority', sql: 'CREATE INDEX IF NOT EXISTS "IDX_workflowrule_isActive_priority" ON "workflow_rules" ("isActive", "priority")' },
            { name: 'IDX_workflowrule_deletedAt', sql: 'CREATE INDEX IF NOT EXISTS "IDX_workflowrule_deletedAt" ON "workflow_rules" ("deletedAt")' },
        ];

        console.log('Applying indexes...\n');

        for (const { name, sql } of indexes) {
            try {
                await client.query(sql);
                console.log(`  ✓ ${name}`);
            } catch (error: any) {
                console.log(`  ✗ ${name}: ${error.message}`);
            }
        }

        console.log('\n✓ Done!');
    } catch (error: any) {
        console.error('Connection error:', error.message);
    } finally {
        await client.end();
    }
}

applyIndexes();
