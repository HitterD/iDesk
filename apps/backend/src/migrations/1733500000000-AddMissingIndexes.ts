import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Add Missing Database Indexes
 * 
 * This migration adds indexes to optimize common query patterns:
 * - User: role, isActive lookups
 * - TicketMessage: ticket message fetch with ordering
 * - Notification: unread count and user notification list
 * - Article: status/visibility filtering
 * - WorkflowRule: active rule lookup by priority
 */
export class AddMissingIndexes1733500000000 implements MigrationInterface {
    name = 'AddMissingIndexes1733500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // User indexes - for agent/admin lookups
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_role" ON "users" ("role")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_isActive" ON "users" ("isActive")`);

        // TicketMessage indexes - for message fetch with ordering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ticketmsg_ticketId" ON "ticket_messages" ("ticketId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ticketmsg_ticketId_createdAt" ON "ticket_messages" ("ticketId", "createdAt")`);

        // Notification indexes - for unread count and user notification list
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notification_userId_isRead" ON "notifications" ("userId", "isRead")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notification_userId_createdAt" ON "notifications" ("userId", "createdAt")`);

        // Article indexes - for status/visibility filtering
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_article_status" ON "articles" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_article_status_visibility" ON "articles" ("status", "visibility")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_article_category" ON "articles" ("category")`);

        // WorkflowRule indexes - for active rule lookup by priority
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_workflowrule_isActive_priority" ON "workflow_rules" ("isActive", "priority")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_workflowrule_deletedAt" ON "workflow_rules" ("deletedAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_role"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_isActive"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ticketmsg_ticketId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ticketmsg_ticketId_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_userId_isRead"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_userId_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_article_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_article_status_visibility"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_article_category"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflowrule_isActive_priority"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workflowrule_deletedAt"`);
    }
}
