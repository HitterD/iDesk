import { CsiHcTemplateMultisite1794210000000 } from './1794210000000-CsiHcTemplateMultisite';

describe('CsiHcTemplateMultisite migration', () => {
    const run = async (direction: 'up' | 'down') => {
        const queries: string[] = [];
        await new CsiHcTemplateMultisite1794210000000()[direction]({ query: async (sql: string) => queries.push(sql) } as any);
        return queries.join('\n');
    };

    it('adds nullable identity, confirmation, team link and PIC tagline columns', async () => {
        const sql = await run('up');
        for (const column of ['"raterNik" varchar(20) NULL', '"confirmedAt" timestamp NULL', '"confirmedById" uuid NULL', '"picNik" varchar(20) NULL', '"teamId" uuid NULL']) {
            expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
        }
        expect(sql).toContain('ALTER TABLE "csi_pics" ADD COLUMN IF NOT EXISTS "tagline" varchar(90) NULL');
        expect(sql).toContain('REFERENCES "csi_teams"("id") ON DELETE SET NULL');
    });

    it('allows multiple custom teams but keeps one site team per scope and site', async () => {
        const sql = await run('up');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS "kind" varchar(10) NOT NULL DEFAULT \'SITE\'');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS "serviceCode" varchar(10) NULL');
        expect(sql).toContain('ALTER TABLE "csi_teams" DROP CONSTRAINT IF EXISTS "UQ_csi_teams_scope_site"');
        expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_teams_site_kind" ON "csi_teams" ("scope", "siteId") WHERE "kind" = \'SITE\'');
        expect(sql).toContain('DROP INDEX IF EXISTS "UQ_csi_period_ratees_team_site"');
        expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_team" ON "csi_period_ratees" ("periodId", "teamId") WHERE "kind" = \'TEAM\'');
    });

    it('creates members with unique names per team and safe deletion policies', async () => {
        const sql = await run('up');
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS "csi_team_members"');
        expect(sql).toContain('"teamId" uuid NOT NULL REFERENCES "csi_teams"("id") ON DELETE CASCADE');
        expect(sql).toContain('"userId" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL');
        expect(sql).toContain('"name" varchar(150) NOT NULL');
        expect(sql).toContain('"nik" varchar(20) NULL');
        expect(sql).toContain('"sortOrder" int NOT NULL DEFAULT 0');
        expect(sql).toContain('UNIQUE ("teamId", "name")');
        expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|^\s*UPDATE\b/m);
    });

    it('reverses additions and restores original uniqueness', async () => {
        const sql = await run('down');
        expect(sql).toContain('DROP TABLE IF EXISTS "csi_team_members"');
        for (const column of ['raterNik', 'confirmedAt', 'confirmedById', 'picNik', 'teamId', 'kind', 'serviceCode', 'tagline']) {
            expect(sql).toContain(`DROP COLUMN IF EXISTS "${column}"`);
        }
        expect(sql).toContain('DROP INDEX IF EXISTS "UQ_csi_teams_site_kind"');
        expect(sql).toContain('ADD CONSTRAINT "UQ_csi_teams_scope_site" UNIQUE ("scope", "siteId")');
        expect(sql).toContain('DROP INDEX IF EXISTS "UQ_csi_period_ratees_team"');
        expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_csi_period_ratees_team_site" ON "csi_period_ratees" ("periodId", "siteId") WHERE "kind" = \'TEAM\'');
    });
});
