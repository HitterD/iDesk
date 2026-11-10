import { buildHcRecap, CSI_SMALL_BAGIAN_LABEL, CsiHcPic, CsiHcRating } from './csi-hc-report.calc';
import { CSI_SMALL_GROUP_LABEL } from '../csi.constants';
import { CsiOrgLocation } from './csi-org.constants';

const DIMS = ['Knowledge', 'Responsiveness'];
const pics: CsiHcPic[] = [
    { periodRateeId: 'a', name: 'ANITA', jobTitle: 'Payroll', serviceCode: 'HCC', bagian: 'PAYROLL & BENEFIT', serviceFunction: 'Benefit, Payroll & HRIS' },
    { periodRateeId: 'b', name: 'BUDI', jobTitle: 'Payroll', serviceCode: 'HCC', bagian: 'PAYROLL & BENEFIT', serviceFunction: null },
    { periodRateeId: 'c', name: 'CICI', jobTitle: 'GA', serviceCode: 'HCS', bagian: 'GA MANAGEMENT', serviceFunction: null },
    { periodRateeId: 'd', name: 'DODI', jobTitle: 'TA', serviceCode: 'HCD', bagian: 'TALENT ACQUISITION & ASSESSMENT', serviceFunction: null },
];
const rating = (responseId: string, periodRateeId: string, location: CsiOrgLocation | null, scores: number[], division = 'OPERATION SJA 1'): CsiHcRating => ({
    responseId, periodRateeId, location,
    respondent: { name: `R-${responseId}`, division, department: 'QUALITY CONTROL', bagian: 'QC' },
    scores: Object.fromEntries(DIMS.map((label, index) => [label, scores[index]])),
});

describe('buildHcRecap', () => {
    const ratings = [
        rating('r1', 'a', CsiOrgLocation.SJA1, [5, 4]), // 4.5
        rating('r1', 'c', CsiOrgLocation.SJA1, [3, 3]), // 3
        rating('r2', 'a', CsiOrgLocation.SJA2, [4, 4], 'MARKETING'), // 4
        rating('r2', 'b', CsiOrgLocation.SJA2, [2, 4], 'MARKETING'), // 3
    ];
    const recap = buildHcRecap({ pics, ratings, dimensions: DIMS });
    const row = (key: string) => recap.services.find((entry) => entry.key === key)!;

    it('averages every rating per location and ALL SJA', () => {
        expect(recap.overall.all).toEqual({ average: 3.63, ratings: 4 });
        expect(recap.overall.byLocation.SJA1).toEqual({ average: 3.75, ratings: 2 });
        expect(recap.overall.byLocation.SJA3).toEqual({ average: null, ratings: 0 });
        expect(recap.overall.respondents).toBe(2);
        expect(recap.overall.dimensions).toEqual({ Knowledge: 3.5, Responsiveness: 3.75 });
    });

    it('builds layanan → bagian → PIC rows, PICs without ratings included', () => {
        expect(recap.services.map((entry) => entry.key)).toEqual([
            's:HCC', 'b:HCC:PAYROLL & BENEFIT', 'p:a', 'p:b',
            's:HCD', 'b:HCD:TALENT ACQUISITION & ASSESSMENT', 'p:d',
            's:HCS', 'b:HCS:GA MANAGEMENT', 'p:c',
        ]);
        expect(row('s:HCC').all).toEqual({ average: 3.83, ratings: 3 });
        expect(row('p:a').byLocation.SJA1.average).toBe(4.5);
        expect(row('p:a').byLocation.SJA2.average).toBe(4);
        expect(row('p:a').dimensions).toEqual({ Knowledge: 4.5, Responsiveness: 4 });
        expect(row('p:d').all).toEqual({ average: null, ratings: 0 });
        expect(row('p:a').serviceFunction).toBe('Benefit, Payroll & HRIS');
        expect(row('s:HCC').serviceFunction).toBeNull();
    });

    it('groups respondents by division → department → bagian and lists each answer', () => {
        // Each unit here has 1 respondent (< CSI_ANON_MIN_GROUP): all of them sit in the merged row only.
        expect(recap.respondentGroups.map((entry) => [entry.level, entry.label, entry.all.average]))
            .toEqual([['division', CSI_SMALL_GROUP_LABEL, 3.63]]);
        const r1 = recap.respondents.find((entry) => entry.responseId === 'r1')!;
        expect(r1.pics.map((pic) => [pic.name, pic.average])).toEqual([['ANITA', 4.5], ['CICI', 3]]);
        expect(r1.average).toBe(3.75);
    });

    it('anon boundary: respondent departments of 3 are kept, 2 are merged into one row', () => {
        const unit = (responseId: string, department: string, bagian = 'QC'): CsiHcRating => ({
            responseId, periodRateeId: 'a', location: CsiOrgLocation.SJA1, scores: { Knowledge: 4, Responsiveness: 4 },
            respondent: { name: `R-${responseId}`, division: 'OPERATION', department, bagian },
        });
        const merged = buildHcRecap({
            pics, dimensions: DIMS, ratings: [
                unit('k1', 'PRODUKSI', 'LINE 1'), unit('k2', 'PRODUKSI', 'LINE 1'), unit('k3', 'PRODUKSI', 'LINE 2'),
                unit('g1', 'GUDANG'), unit('g2', 'GUDANG'), unit('q1', 'QC'),
            ],
        });
        // PRODUKSI (3) stays; its bagians (2 + 1) share one row; GUDANG (2) and QC (1) leave the division into one row.
        expect(merged.respondentGroups.map((entry) => [entry.level, entry.label, entry.all.ratings])).toEqual([
            ['division', 'OPERATION', 3], ['department', 'PRODUKSI', 3], ['bagian', CSI_SMALL_BAGIAN_LABEL, 3],
            ['division', CSI_SMALL_GROUP_LABEL, 3],
        ]);
        expect(JSON.stringify(merged.respondentGroups)).not.toMatch(/GUDANG|LINE/);
        // Nothing small: no merged row.
        const large = buildHcRecap({ pics, dimensions: DIMS, ratings: ['x1', 'x2', 'x3'].map((id) => unit(id, 'PRODUKSI')) });
        expect(large.respondentGroups.map((entry) => entry.label)).toEqual(['OPERATION', 'PRODUKSI', 'QC']);
    });
});
