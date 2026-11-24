import { QueryRunner } from 'typeorm';
import { CsiProcurementMoveToSpj1794880000000 } from './1794880000000-CsiProcurementMoveToSpj';

describe('CsiProcurementMoveToSpj migration', () => {
    it('moves Procurement PICs, draft ratees, and KRW template to SPJ (SJA 1)', async () => {
        const calls: Array<{ sql: string; params?: unknown[] }> = [];
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            calls.push({ sql, params });
            if (sql.includes('FROM "sites"') && params?.[0] === 'SPJ') return [{ id: 'site-spj' }];
            if (sql.includes('FROM "sites"') && params?.[0] === 'KRW') return [{ id: 'site-krw' }];
            if (sql.includes('FROM "csi_assignment_templates"')) return [];
            return [];
        });

        await new CsiProcurementMoveToSpj1794880000000().up({ query } as unknown as QueryRunner);

        const picUpdate = calls.find((c) => c.sql.includes('UPDATE "csi_pics"'));
        expect(picUpdate?.params).toEqual(['site-spj', 'PROCUREMENT', 'site-krw']);

        const tplUpdate = calls.find((c) => c.sql.includes('UPDATE "csi_assignment_templates"'));
        expect(tplUpdate?.params).toEqual(['SPJ', 'CSI Procurement 2026 – Sepanjang', 'PROCUREMENT', 'KRW']);
    });

    it('skips template rename if SPJ template already exists', async () => {
        const calls: Array<{ sql: string; params?: unknown[] }> = [];
        const query = jest.fn(async (sql: string, params?: unknown[]) => {
            calls.push({ sql, params });
            if (sql.includes('FROM "sites"') && params?.[0] === 'SPJ') return [{ id: 'site-spj' }];
            if (sql.includes('FROM "sites"') && params?.[0] === 'KRW') return [{ id: 'site-krw' }];
            if (sql.includes('FROM "csi_assignment_templates"')) return [{ id: 'tpl-spj' }];
            return [];
        });

        await new CsiProcurementMoveToSpj1794880000000().up({ query } as unknown as QueryRunner);

        expect(calls.some((c) => c.sql.includes('UPDATE "csi_assignment_templates"'))).toBe(false);
    });
});
