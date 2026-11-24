import { QueryRunner } from 'typeorm';
import { CsiProcurementPortal1794870000000 } from './1794870000000-CsiProcurementPortal';

const EXISTING_ROLES = [
    { enumlabel: 'ADMIN' },
    { enumlabel: 'MANAGER' },
    { enumlabel: 'AGENT' },
    { enumlabel: 'HC_ADMIN' },
    { enumlabel: 'USER' },
];

type QueryCall = { sql: string; params?: unknown[] };

function createRunner(options?: { roles?: Array<{ enumlabel: string }>; orgPeople?: Array<Record<string, unknown>> }) {
    const calls: QueryCall[] = [];
    let tplPicSeq = 0;
    let picSeq = 0;

    const query = jest.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes('FROM pg_enum')) return options?.roles ?? EXISTING_ROLES;
        if (sql.includes('FROM "permission_presets"')) return [];
        if (sql.includes('INSERT INTO "permission_presets"')) return [{ id: 'preset-proc-1' }];
        if (sql.includes('FROM "users" WHERE "employeeId"')) return [];
        if (sql.includes('FROM "csi_dimensions"')) return [];
        if (sql.includes('FROM "sites"')) return [{ id: 'site-krw' }];
        if (sql.includes('FROM "users" WHERE "isActive" = true')) return [];
        if (sql.includes('FROM "csi_org_people"')) return options?.orgPeople ?? [];
        if (sql.includes('FROM "csi_assignment_templates"')) return [];
        if (sql.includes('INSERT INTO "csi_assignment_templates"')) return [{ id: 'tpl-krw-1' }];
        if (sql.includes('FROM "csi_pics"')) return [];
        if (sql.includes('INSERT INTO "csi_pics"')) return [{ id: `pic-${++picSeq}` }];
        if (sql.includes('FROM "csi_assignment_template_pics"')) return [];
        if (sql.includes('INSERT INTO "csi_assignment_template_pics"')) return [{ id: `tpl-pic-${++tplPicSeq}` }];
        return [];
    });

    return { calls, runner: { query } as unknown as QueryRunner };
}

describe('CsiProcurementPortal migration', () => {
    const originalPasswordEnv = process.env.PROCUREMENT_ADMIN_INITIAL_PASSWORD;

    afterEach(() => {
        if (originalPasswordEnv === undefined) delete process.env.PROCUREMENT_ADMIN_INITIAL_PASSWORD;
        else process.env.PROCUREMENT_ADMIN_INITIAL_PASSWORD = originalPasswordEnv;
    });

    it('widens scope columns, adds PROCUREMENT_ADMIN enum, seeds account, dimensions, 2 PICs and KRW raters', async () => {
        delete process.env.PROCUREMENT_ADMIN_INITIAL_PASSWORD;
        const { calls, runner } = createRunner();

        await new CsiProcurementPortal1794870000000().up(runner);

        const sqls = calls.map((call) => call.sql);
        expect(sqls.filter((sql) => sql.includes('ALTER COLUMN "scope" TYPE varchar(20)'))).toHaveLength(13);
        expect(sqls).toContain(
            `CREATE TYPE "users_role_enum" AS ENUM ('ADMIN', 'MANAGER', 'AGENT', 'HC_ADMIN', 'USER', 'PROCUREMENT_ADMIN')`,
        );

        const presetInsert = calls.find((call) => call.sql.includes('INSERT INTO "permission_presets"'));
        expect(presetInsert?.params?.[0]).toBe('Admin Procurement');
        expect(presetInsert?.params?.[2]).toBe(JSON.stringify({ notifications: true, csi_admin_procurement: true }));

        const userInsert = calls.find((call) => call.sql.includes('INSERT INTO "users"'));
        expect(userInsert?.params).toEqual([
            'admin.procurement@santosjayaabadi.co.id',
            null,
            'Admin Procurement',
            'PROCUREMENT_ADMIN',
            'admin.procurement',
            'preset-proc-1',
            'Admin Procurement',
        ]);

        const dimensionInserts = calls.filter((call) => call.sql.includes('INSERT INTO "csi_dimensions"'));
        expect(dimensionInserts).toHaveLength(5);
        expect(dimensionInserts.map((c) => c.params?.[2])).toEqual([
            'Knowledge',
            'Responsiveness',
            'Courtesy',
            'Communication',
            'Tangible',
        ]);

        const picInserts = calls.filter((call) => call.sql.includes('INSERT INTO "csi_pics"'));
        expect(picInserts.map((c) => c.params?.[2])).toEqual([
            'NEVYLIA RACHMAWATI SAUFIN',
            'ADITYA TRI HARJOYUDHANTO',
        ]);

        const raterInserts = calls.filter((call) => call.sql.includes('INSERT INTO "csi_assignment_template_raters"'));
        expect(raterInserts).toHaveLength(30);
    });

    it('skips enum recreation when PROCUREMENT_ADMIN is already present', async () => {
        const { calls, runner } = createRunner({
            roles: [...EXISTING_ROLES, { enumlabel: 'PROCUREMENT_ADMIN' }],
        });

        await new CsiProcurementPortal1794870000000().up(runner);

        expect(calls.some((call) => call.sql.includes('CREATE TYPE "users_role_enum"'))).toBe(false);
    });

    it('removes seeded Procurement data on down', async () => {
        const { calls, runner } = createRunner();

        await new CsiProcurementPortal1794870000000().down(runner);

        const sqls = calls.map((call) => call.sql);
        expect(sqls).toEqual([
            `DELETE FROM "csi_assignment_templates" WHERE "scope" = $1`,
            `DELETE FROM "csi_pics" WHERE "scope" = $1`,
            `DELETE FROM "csi_dimensions" WHERE "scope" = $1`,
            `DELETE FROM "csi_departments" WHERE "scope" = $1`,
            `DELETE FROM "users" WHERE "employeeId" = $1 OR "email" = $2`,
            `DELETE FROM "permission_presets" WHERE "name" = $1 AND "isSystem" = true`,
        ]);
    });
});
