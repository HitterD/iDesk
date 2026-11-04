import { QueryRunner } from 'typeorm';
import { CSI_DEPARTMENT_NAMES_2026, CSI_DEPARTMENTS_2026 } from '../modules/csi/csi-departments.data';
import { CsiDepartmentsFromHierarchy1794110000000 } from './1794110000000-CsiDepartmentsFromHierarchy';

const NAME_MAX = 100;

describe('CsiDepartmentsFromHierarchy1794110000000', () => {
    const migration = new CsiDepartmentsFromHierarchy1794110000000();
    let calls: Array<[string, unknown[] | undefined]>;
    let queryRunner: QueryRunner;

    beforeEach(() => {
        calls = [];
        queryRunner = { query: jest.fn(async (sql: string, params?: unknown[]) => { calls.push([sql, params]); }) } as unknown as QueryRunner;
    });

    it('deactivates the old list first, then upserts every department for ICT and HC', async () => {
        await migration.up(queryRunner);
        expect(calls[0][0]).toMatch(/UPDATE "csi_departments" SET "isActive" = false/);
        const inserts = calls.slice(1);
        expect(inserts).toHaveLength(CSI_DEPARTMENT_NAMES_2026.length * 2);
        expect(inserts[0][0]).toMatch(/ON CONFLICT \("scope", lower\("name"\)\) DO UPDATE SET "isActive" = true/);
        expect(inserts.map(([, params]) => params![0])).toEqual([
            ...CSI_DEPARTMENT_NAMES_2026.map(() => 'ICT'), ...CSI_DEPARTMENT_NAMES_2026.map(() => 'HC'),
        ]);
    });

    it('list is clean: unique, fits the column, typo fixed, no job titles', () => {
        expect(new Set(CSI_DEPARTMENT_NAMES_2026.map((name) => name.toLowerCase())).size).toBe(CSI_DEPARTMENT_NAMES_2026.length);
        expect(Math.max(...CSI_DEPARTMENT_NAMES_2026.map((name) => name.length))).toBeLessThanOrEqual(NAME_MAX);
        expect(CSI_DEPARTMENT_NAMES_2026).toContain('ICT / SECURITY & NETWORK INFRASTRUCTURE');
        expect(CSI_DEPARTMENT_NAMES_2026.join('|')).not.toMatch(/INFRASTURCTURE|GENERAL MANAGER|PLANT MANAGER/);
        expect(CSI_DEPARTMENTS_2026.map((group) => group.division)).toContain('HUMAN CAPITAL');
    });
});
