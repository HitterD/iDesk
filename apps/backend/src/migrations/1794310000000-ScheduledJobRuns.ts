import { MigrationInterface, QueryRunner } from 'typeorm';

/** One row per (scheduled job, period) that ran; makes daily reminder crons run once even with several replicas. */
export class ScheduledJobRuns1794310000000 implements MigrationInterface {
    name = 'ScheduledJobRuns1794310000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "scheduled_job_runs" (
                "job" varchar(100) NOT NULL,
                "period" varchar(40) NOT NULL,
                "ranAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_scheduled_job_runs" PRIMARY KEY ("job", "period")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_job_runs"`);
    }
}
