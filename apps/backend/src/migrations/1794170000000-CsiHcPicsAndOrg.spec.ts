import { CsiHcPicsAndOrg1794170000000 } from './1794170000000-CsiHcPicsAndOrg';

describe('CsiHcPicsAndOrg migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiHcPicsAndOrg1794170000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds the directory, the PIC master and nullable columns only (nothing existing is dropped)', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_org_people"');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_pics"');
        expect(sql).toContain('"UQ_csi_pics_scope_nik"');
        expect(sql).toMatch(/"picId" uuid NULL/);
        expect(sql).toMatch(/"respondentPicks" boolean NOT NULL DEFAULT false/);
        expect(sql).toMatch(/"orgLocation" varchar\(10\) NULL/);
        expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM|^\s*UPDATE\b/m);
    });

    it('down removes only what it added', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP TABLE IF EXISTS "csi_pics"');
        expect(sql).toContain('DROP TABLE IF EXISTS "csi_org_people"');
        expect(sql).not.toContain('DROP TABLE IF EXISTS "csi_responses"');
    });
});
