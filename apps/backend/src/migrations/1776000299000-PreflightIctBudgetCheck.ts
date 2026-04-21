import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreflightIctBudgetCheck1776000299000 implements MigrationInterface {
    name = 'PreflightIctBudgetCheck1776000299000';

    async up(q: QueryRunner): Promise<void> {
        const hasTable = await q.hasTable('ict_budgets');
        if (!hasTable) {
            console.log('[preflight] ict_budgets table not found — skipping preflight');
            return;
        }

        const [{ count: total }] = await q.query(`SELECT COUNT(*) FROM ict_budgets`);
        console.log(`[preflight] ict_budgets total rows: ${total}`);

        const [{ count: nullSite }] = await q.query(
            `SELECT COUNT(*) FROM ict_budgets WHERE site_id IS NULL`,
        );
        if (parseInt(nullSite, 10) > 0) {
            const [firstSite] = await q.query(
                `SELECT id FROM sites ORDER BY created_at LIMIT 1`,
            );
            if (!firstSite) {
                throw new Error(
                    `[preflight] ${nullSite} ict_budgets rows have NULL site_id and no fallback site exists. ` +
                    `Create at least one site before running this migration.`,
                );
            }
            console.warn(
                `[preflight] WARN: ${nullSite} rows have NULL site_id — will use fallback site ${firstSite.id}`,
            );
        }

        const unknownStatuses = await q.query(`
            SELECT DISTINCT
                CASE
                    WHEN completed_at IS NOT NULL THEN 'COMPLETED'
                    WHEN approved_at IS NOT NULL THEN 'PROCUREMENT'
                    ELSE 'DRAFT'
                END AS mapped_status
            FROM ict_budgets
        `);
        console.log('[preflight] status mapping preview:', unknownStatuses);

        await q.query(`
            CREATE TABLE IF NOT EXISTS ict_budgets_backup_1776000299000
            AS SELECT * FROM ict_budgets
        `);
        const [{ count: backupCount }] = await q.query(
            `SELECT COUNT(*) FROM ict_budgets_backup_1776000299000`,
        );
        if (backupCount !== total) {
            throw new Error(
                `[preflight] Backup row count mismatch: original=${total} backup=${backupCount}`,
            );
        }
        console.log(`[preflight] Backup created: ict_budgets_backup_1776000299000 (${backupCount} rows)`);
    }

    async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS ict_budgets_backup_1776000299000`);
    }
}
