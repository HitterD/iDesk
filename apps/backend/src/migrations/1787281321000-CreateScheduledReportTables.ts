import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates tables for the Scheduled Reports feature:
 * - scheduled_report_configs
 * - scheduled_report_executions
 *
 * Includes:
 * - Enum types for ReportType, ScheduleType, TargetAgentCategory, ExecutionStatus
 * - Proper foreign keys with site + user references
 * - Indexes for common query patterns (site+active, schedule+active, config+executedAt)
 * - JSONB for execution metadata
 * - Soft delete support on configs (deletedAt)
 *
 * NOTE: This migration is idempotent where possible (CREATE TYPE ... IF NOT EXISTS via DO blocks,
 * CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, and DO blocks for FKs).
 */
export class CreateScheduledReportTables1787281321000 implements MigrationInterface {
  name = 'CreateScheduledReportTables1787281321000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid extension exists (safe if already present)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // --- ENUM TYPES (idempotent) ---
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scheduled_report_report_type AS ENUM ('MONTHLY_SUMMARY', 'AGENT_PERFORMANCE', 'TICKET_VOLUME');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scheduled_report_schedule_type AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scheduled_report_target_agent_category AS ENUM ('ALL', 'REGULAR', 'ORACLE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE scheduled_report_execution_status AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // --- TABLE: scheduled_report_configs ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduled_report_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "reportType" scheduled_report_report_type NOT NULL,
        "schedule" scheduled_report_schedule_type NOT NULL,
        "sendTime" character varying(5) NOT NULL DEFAULT '07:00',
        "siteId" uuid NOT NULL,
        "recipientUserIds" text NOT NULL,
        "targetAgentCategory" scheduled_report_target_agent_category NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdById" uuid NULL,
        "lastRunAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP NULL
      )
    `);

    // Foreign keys (sites + users) — guarded
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_scheduled_report_configs_siteId'
        ) THEN
          ALTER TABLE "scheduled_report_configs"
          ADD CONSTRAINT "FK_scheduled_report_configs_siteId"
          FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_scheduled_report_configs_createdById'
        ) THEN
          ALTER TABLE "scheduled_report_configs"
          ADD CONSTRAINT "FK_scheduled_report_configs_createdById"
          FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scheduled_report_configs_site_active"
      ON "scheduled_report_configs" ("siteId", "isActive");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scheduled_report_configs_schedule_active"
      ON "scheduled_report_configs" ("schedule", "isActive");
    `);

    // --- TABLE: scheduled_report_executions ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduled_report_executions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "configId" uuid NOT NULL,
        "executedAt" TIMESTAMP NOT NULL,
        "status" scheduled_report_execution_status NOT NULL,
        "recipientsCount" integer NOT NULL DEFAULT 0,
        "emailsSent" integer NOT NULL DEFAULT 0,
        "errorMessage" text NULL,
        "metadata" jsonb NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // FK to configs with CASCADE delete (guarded)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_scheduled_report_executions_configId'
        ) THEN
          ALTER TABLE "scheduled_report_executions"
          ADD CONSTRAINT "FK_scheduled_report_executions_configId"
          FOREIGN KEY ("configId") REFERENCES "scheduled_report_configs"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Index for querying history by config + time
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scheduled_report_executions_config_executed"
      ON "scheduled_report_executions" ("configId", "executedAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_report_executions_config_executed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_report_configs_schedule_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scheduled_report_configs_site_active"`);

    // Drop FKs (best effort)
    await queryRunner.query(`
      ALTER TABLE "scheduled_report_executions" DROP CONSTRAINT IF EXISTS "FK_scheduled_report_executions_configId"
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_report_configs" DROP CONSTRAINT IF EXISTS "FK_scheduled_report_configs_createdById"
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_report_configs" DROP CONSTRAINT IF EXISTS "FK_scheduled_report_configs_siteId"
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_report_executions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_report_configs"`);

    // Drop enums (order matters due to usage)
    await queryRunner.query(`DROP TYPE IF EXISTS scheduled_report_execution_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS scheduled_report_target_agent_category`);
    await queryRunner.query(`DROP TYPE IF EXISTS scheduled_report_schedule_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS scheduled_report_report_type`);
  }
}
