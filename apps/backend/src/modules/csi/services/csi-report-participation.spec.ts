import { CSI_SMALL_GROUP_LABEL } from '../csi.constants';
import { departmentParticipation, slaBlock } from './csi-report-participation';

const raters = (department: string, total: number, answered: number) =>
    Array.from({ length: total }, (_, index) => ({ department, answered: index < answered }));

describe('csi-report-participation', () => {
    it('sla met/missing', () => {
        expect(slaBlock({ basis: 40, targetPct: 90, target: 36, responses: 33 })).toEqual({
            basis: 40, submitted: 33, pct: 83, targetPct: 90, targetCount: 36, met: false, missing: 3,
        });
        expect(slaBlock({ basis: 40, targetPct: 90, target: 36, responses: 36 })).toMatchObject({ met: true, missing: 0, pct: 90 });
        // More answers than the basis still reads as 100%.
        expect(slaBlock({ basis: 10, targetPct: 80, target: 8, responses: 12 })).toMatchObject({ pct: 100, met: true, missing: 0 });
        expect(slaBlock({ basis: 0, targetPct: 80, target: 0, responses: 0 })).toMatchObject({ pct: 0, met: false, missing: 0 });
    });

    it('anon boundary (3 kept, 2 merged)', () => {
        const rows = departmentParticipation([
            ...raters('PRODUKSI', 3, 1), ...raters('GUDANG', 2, 2), ...raters('QC', 1, 0), ...raters('KEUANGAN', 4, 4),
        ], 80);
        // Sorted by % ascending then name (the merged row included).
        expect(rows).toEqual([
            { name: 'PRODUKSI', submitted: 1, total: 3, pct: 33, met: false },
            { name: CSI_SMALL_GROUP_LABEL, submitted: 2, total: 3, pct: 67, met: false },
            { name: 'KEUANGAN', submitted: 4, total: 4, pct: 100, met: true },
        ]);
        expect(JSON.stringify(rows)).not.toMatch(/GUDANG|QC/);
    });

    it('no merged row when every department has at least 3 raters; met uses the exact share', () => {
        // 9 of 10 = 90% exactly; 26 of 29 = 89.66% (rounds to 90 but is below the target).
        const rows = departmentParticipation([...raters('A', 10, 9), ...raters('B', 29, 26)], 90);
        expect(rows.map((row) => [row.name, row.pct, row.met])).toEqual([['A', 90, true], ['B', 90, false]]);
        expect(departmentParticipation([], 90)).toEqual([]);
    });
});
