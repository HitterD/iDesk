import { buildHcRecap, CsiHcPic, CsiHcRating } from './csi-hc-report.calc';
import { CsiOrgLocation } from './csi-org.constants';

const DIMS = ['Knowledge', 'Responsiveness'];
const pics: CsiHcPic[] = [
    { periodRateeId: 'a', name: 'ANITA', jobTitle: 'Payroll', serviceCode: 'HCC', bagian: 'PAYROLL & BENEFIT' },
    { periodRateeId: 'b', name: 'BUDI', jobTitle: 'Payroll', serviceCode: 'HCC', bagian: 'PAYROLL & BENEFIT' },
    { periodRateeId: 'c', name: 'CICI', jobTitle: 'GA', serviceCode: 'HCS', bagian: 'GA MANAGEMENT' },
    { periodRateeId: 'd', name: 'DODI', jobTitle: 'TA', serviceCode: 'HCD', bagian: 'TALENT ACQUISITION & ASSESSMENT' },
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
    });

    it('groups respondents by division → department → bagian and lists each answer', () => {
        expect(recap.respondentGroups.filter((entry) => entry.level === 'division').map((entry) => [entry.label, entry.all.average]))
            .toEqual([['MARKETING', 3.5], ['OPERATION SJA 1', 3.75]]);
        const r1 = recap.respondents.find((entry) => entry.responseId === 'r1')!;
        expect(r1.pics.map((pic) => [pic.name, pic.average])).toEqual([['ANITA', 4.5], ['CICI', 3]]);
        expect(r1.average).toBe(3.75);
    });
});
