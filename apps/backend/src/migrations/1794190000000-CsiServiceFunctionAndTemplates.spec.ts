import { CsiServiceFunctionAndTemplates1794190000000 } from './1794190000000-CsiServiceFunctionAndTemplates';

describe('CsiServiceFunctionAndTemplates migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiServiceFunctionAndTemplates1794190000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds the nullable service function to PICs and period ratees only (nothing existing is dropped or rewritten)', async () => {
        const sql = await run('up');
        expect(sql).toMatch(/ALTER TABLE "csi_pics"\s+ADD COLUMN IF NOT EXISTS "serviceFunction" varchar\(150\) NULL/);
        expect(sql).toMatch(/ALTER TABLE "csi_period_ratees"\s+ADD COLUMN IF NOT EXISTS "serviceFunction" varchar\(150\) NULL/);
        expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM|^\s*UPDATE\b/m);
    });

    it('adds the service report owners table with one row per scope/service/user', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_service_report_owners"');
        expect(sql).toContain('"UQ_csi_service_report_owners"');
    });

    it('adds the assignment template tables, unique per scope/location, PIC name and rater name', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_assignment_templates"');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_assignment_template_pics"');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_assignment_template_raters"');
        expect(sql).toContain('"UQ_csi_assignment_templates_scope_location"');
        expect(sql).toContain('"UQ_csi_assignment_template_pics_name"');
        expect(sql).toContain('"UQ_csi_assignment_template_raters_name"');
        const down = await run('down');
        expect(down.indexOf('"csi_assignment_template_raters"')).toBeLessThan(down.indexOf('"csi_assignment_templates"'));
    });

    it('down removes only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP COLUMN IF EXISTS "serviceFunction"');
        expect(sql).not.toContain('DROP TABLE IF EXISTS "csi_pics"');
    });
});
