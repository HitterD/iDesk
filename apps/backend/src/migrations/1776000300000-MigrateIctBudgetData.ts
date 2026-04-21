import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateIctBudgetData1776000300000 implements MigrationInterface {
    name = 'MigrateIctBudgetData1776000300000';

    async up(q: QueryRunner): Promise<void> {
        const hasBudgets = await q.hasTable('ict_budgets');
        if (!hasBudgets) return;

        const backupExists = await q.hasTable('ict_budgets_backup_1776000299000');
        if (!backupExists) {
            throw new Error(
                '[migration] Preflight backup table ict_budgets_backup_1776000299000 not found. ' +
                'Run migration 1776000299000-PreflightIctBudgetCheck first.',
            );
        }

        const dryRun = process.env.HARDWARE_MIGRATION_DRY_RUN === 'true';
        if (dryRun) {
            console.log('[migration] DRY_RUN mode — changes will be rolled back');
            await q.startTransaction();
        }

        try {
            const [{ count: sourceBefore }] = await q.query(`SELECT COUNT(*) FROM ict_budgets`);
            console.log(`[migration] ict_budgets source rows: ${sourceBefore}`);

            // Status mapping: COMPLETED/PROCUREMENT keep semantics; unknown → DRAFT (for manual review)
            await q.query(`
                INSERT INTO hardware_requests
                    (id, request_number, requester_id, site_id, justification, status,
                     submitted_at, approved_at, procured_at, completed_at, version, created_at, updated_at)
                SELECT
                    b.id,
                    'HR-' || EXTRACT(YEAR FROM b.created_at)::text || '-' ||
                        LPAD((ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM b.created_at) ORDER BY b.created_at) + 9000)::text, 4, '0'),
                    b.user_id,
                    COALESCE(b.site_id, (SELECT id FROM sites ORDER BY created_at LIMIT 1)),
                    COALESCE(NULLIF(b.note, ''), 'Migrated from ICT budget'),
                    CASE
                        WHEN b.completed_at IS NOT NULL THEN 'COMPLETED'::request_status_enum
                        WHEN b.approved_at IS NOT NULL THEN 'PROCUREMENT'::request_status_enum
                        ELSE 'DRAFT'::request_status_enum
                    END,
                    b.created_at, b.approved_at, b.approved_at, b.completed_at,
                    1, b.created_at, COALESCE(b.completed_at, b.approved_at, b.created_at)
                FROM ict_budgets b
                WHERE NOT EXISTS (SELECT 1 FROM hardware_requests r WHERE r.id = b.id);
            `);

            const [{ count: inserted }] = await q.query(
                `SELECT COUNT(*) FROM hardware_requests WHERE request_number LIKE 'HR-%-9%'`,
            );
            console.log(`[migration] hardware_requests inserted/existing: ${inserted}`);

            const hasItems = await q.hasTable('ict_budget_items');
            if (hasItems) {
                await q.query(`
                    INSERT INTO hardware_request_items
                        (id, request_id, catalog_id, category_snapshot, quantity, actual_cost, vendor, invoice_number)
                    SELECT
                        i.id,
                        i.budget_id,
                        NULL,
                        jsonb_build_object('category', 'OTHER', 'name', COALESCE(i.name, 'Item legacy'), 'code', 'LEGACY'),
                        COALESCE(i.quantity, 1),
                        i.cost, i.vendor, i.invoice
                    FROM ict_budget_items i
                    WHERE EXISTS (SELECT 1 FROM hardware_requests r WHERE r.id = i.budget_id)
                      AND NOT EXISTS (SELECT 1 FROM hardware_request_items h WHERE h.id = i.id);
                `);
            }

            if (dryRun) {
                await q.rollbackTransaction();
                console.log('[migration] DRY_RUN rollback complete — no data changed');
            }
        } catch (err) {
            if (dryRun) await q.rollbackTransaction();
            throw err;
        }
    }

    async down(_q: QueryRunner): Promise<void> {
        // Data port is one-way. Restore from ict_budgets_backup_1776000299000 if needed.
    }
}
