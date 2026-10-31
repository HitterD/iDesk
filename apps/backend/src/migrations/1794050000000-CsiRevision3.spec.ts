import { QueryRunner } from 'typeorm';
import { CsiRevision31794050000000 } from './1794050000000-CsiRevision3';

describe('CsiRevision31794050000000', () => {
    const migration = new CsiRevision31794050000000();
    let statements: string[];
    let queryRunner: QueryRunner;

    beforeEach(() => {
        statements = [];
        queryRunner = { query: jest.fn(async (sql: string) => { statements.push(sql); }) } as unknown as QueryRunner;
    });

    it('creates master tables with scoped uniqueness and foreign keys', async () => {
        await migration.up(queryRunner);
        const sql = statements.join('\n');
        for (const table of ['csi_teams', 'csi_subject_profiles', 'csi_rater_assignments', 'csi_period_rater_ratees']) {
            expect(sql).toContain(`CREATE TABLE "${table}"`);
        }
        expect(sql).toContain('UNIQUE ("scope", "siteId")');
        expect(sql).toContain('UNIQUE ("scope", "userId")');
        expect(sql).toContain('UNIQUE ("scope", "raterUserId", "subjectKey")');
        expect(sql).toContain('UNIQUE ("periodRaterId", "periodRateeId")');
        expect(sql).toContain('REFERENCES "sites"("id")');
        for (const table of ['users', 'csi_periods', 'csi_period_raters', 'csi_period_ratees']) {
            expect(sql).toContain(`REFERENCES "${table}"("id") ON DELETE CASCADE`);
        }
    });

    it('adds nullable overrides, short labels and the per-site team index', async () => {
        await migration.up(queryRunner);
        const sql = statements.join('\n');
        expect(sql).toContain('DROP INDEX "UQ_csi_period_ratees_team"');
        expect(sql).toContain('CREATE UNIQUE INDEX "UQ_csi_period_ratees_team_site" ON "csi_period_ratees" ("periodId", "siteId") WHERE "kind" = \'TEAM\'');
        for (const column of ['siteId', 'teamId']) expect(sql).toContain(`ADD "${column}" uuid`);
        for (const table of ['csi_dimensions', 'csi_period_ratee_dimensions']) {
            expect(sql).toContain(`ALTER TABLE "${table}" ADD "shortLabel" varchar(40)`);
        }
        expect(sql).toContain('ADD "photoUrl" varchar');
        expect(sql).toContain('ADD "tagline" varchar(90)');
        expect(sql).toMatch(/ADD VALUE IF NOT EXISTS.*CSI_REMINDER/);
    });

    it('backfills people and deterministically selects the first site for legacy teams', async () => {
        await migration.up(queryRunner);
        const sql = statements.join('\n');
        expect(sql).toContain('UPDATE "csi_period_ratees" r SET "siteId" = u."siteId" FROM "users" u WHERE r."userId" = u.id');
        expect(sql).toMatch(/ORDER BY ps\."siteId"\s+LIMIT 1/);
        expect(sql).toContain('p."teamLabel"');
        expect(sql).toContain('ON CONFLICT ("scope", "siteId") DO NOTHING');
        expect(sql).toContain('SET "teamId" = t.id');
        expect(sql.indexOf('SET "siteId"')).toBeLessThan(sql.indexOf('INSERT INTO "csi_teams"'));
        expect(sql.indexOf('INSERT INTO "csi_teams"')).toBeLessThan(sql.indexOf('SET "teamId"'));
    });

    it('reverses dependent changes before dropping the master tables', async () => {
        await migration.down(queryRunner);
        const sql = statements.join('\n');
        expect(sql).toContain('DROP TABLE "csi_period_rater_ratees"');
        expect(sql).toContain('DROP INDEX "UQ_csi_period_ratees_team_site"');
        expect(sql).toContain('CREATE UNIQUE INDEX "UQ_csi_period_ratees_team" ON "csi_period_ratees" ("periodId") WHERE "kind" = \'TEAM\'');
        for (const column of ['siteId', 'teamId', 'photoUrl', 'tagline']) expect(sql).toContain(`DROP COLUMN "${column}"`);
        expect(sql.indexOf('DROP COLUMN "teamId"')).toBeLessThan(sql.indexOf('DROP TABLE "csi_teams"'));
        expect(sql).not.toContain('DELETE FROM');
    });
});
