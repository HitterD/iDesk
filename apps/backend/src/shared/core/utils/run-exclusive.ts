import { DataSource } from 'typeorm';

/**
 * Runs a scheduled job once per period across all backend instances.
 *
 * Every replica fires the same @Cron at about the same moment (and a restart can fire it again); without this,
 * each run sends the same reminders. The first instance to insert (job, period) into `scheduled_job_runs` runs the
 * job; the others see the row and skip. A failed run removes its claim so the next tick can retry.
 *
 * @param period e.g. the WIB date for a daily job (`2026-11-12`)
 * @returns the job's result, or `undefined` when the period was already claimed.
 */
export async function runOncePerPeriod<T>(
    dataSource: DataSource,
    jobName: string,
    period: string,
    job: () => Promise<T>,
): Promise<T | undefined> {
    const claimed = await dataSource.query(
        `INSERT INTO "scheduled_job_runs" ("job", "period") VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING "job"`,
        [jobName, period],
    );
    if (!claimed?.length) return undefined;
    try {
        return await job();
    } catch (error) {
        await dataSource.query(`DELETE FROM "scheduled_job_runs" WHERE "job" = $1 AND "period" = $2`, [jobName, period]);
        throw error;
    }
}
