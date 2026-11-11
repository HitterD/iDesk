import { buildHcRecap, collapseRespondentRows, CsiHcPic, CsiHcRating, CsiRespondentRow, previousOf, recapAverages, recapRowKey } from './csi-hc-report.calc';
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
        // SJA 1 holds one respondent (r1): the count stays, the score is hidden (CSI_ANON_MIN_GROUP).
        expect(recap.overall.byLocation.SJA1).toEqual({ average: null, ratings: 2 });
        expect(recap.overall.byLocation.SJA3).toEqual({ average: null, ratings: 0 });
        expect(recap.overall.respondents).toBe(2);
        expect(recap.overall.dimensions).toEqual({ Knowledge: 3.5, Responsiveness: 3.75 });
    });

    it('builds layanan → bagian → PIC rows, PICs without ratings included', () => {
        // Report order of the layanan everywhere: HCD, HCC, HCS.
        expect(recap.services.map((entry) => entry.key)).toEqual([
            's:HCD', 'b:HCD:TALENT ACQUISITION & ASSESSMENT', 'p:d',
            's:HCC', 'b:HCC:PAYROLL & BENEFIT', 'p:a', 'p:b',
            's:HCS', 'b:HCS:GA MANAGEMENT', 'p:c',
        ]);
        expect(row('s:HCC').all).toEqual({ average: 3.83, ratings: 3 });
        expect(row('p:a').byLocation.SJA1).toEqual({ average: null, ratings: 1 });
        expect(row('p:a').byLocation.SJA2).toEqual({ average: null, ratings: 1 });
        expect(row('p:a').dimensions).toEqual({ Knowledge: 4.5, Responsiveness: 4 });
        expect(row('p:d').all).toEqual({ average: null, ratings: 0 });
        expect(row('p:a').serviceFunction).toBe('Benefit, Payroll & HRIS');
        expect(row('s:HCC').serviceFunction).toBeNull();
    });

    it('groups respondents by division → department → bagian and lists each answer', () => {
        // Each unit here has 1 respondent (< CSI_ANON_MIN_GROUP): all sit in the merged row, which (2 people) shows counts only.
        expect(recap.respondentGroups.map((entry) => [entry.level, entry.label, entry.all.average, entry.respondents]))
            .toEqual([['division', CSI_SMALL_GROUP_LABEL, null, 2]]);
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
        // PRODUKSI (3) stays; its bagians (2 + 1) would need a merged row, so its bagians are hidden (no subtraction);
        // GUDANG (2) and QC (1) leave the division into one row.
        expect(merged.respondentGroups.map((entry) => [entry.level, entry.label, entry.all.ratings])).toEqual([
            ['division', 'OPERATION', 3], ['department', 'PRODUKSI', 3],
            ['division', CSI_SMALL_GROUP_LABEL, 3],
        ]);
        expect(JSON.stringify(merged.respondentGroups)).not.toMatch(/GUDANG|LINE/);
        // Nothing small: no merged row.
        const large = buildHcRecap({ pics, dimensions: DIMS, ratings: ['x1', 'x2', 'x3'].map((id) => unit(id, 'PRODUKSI')) });
        expect(large.respondentGroups.map((entry) => entry.label)).toEqual(['OPERATION', 'PRODUKSI', 'QC']);
    });

    it('a merged row below 3 respondents shows only its count, never a score or a location', () => {
        const one = (responseId: string, department: string, bagian: string, location = CsiOrgLocation.SJA1): CsiHcRating => ({
            responseId, periodRateeId: 'a', location, scores: { Knowledge: 2, Responsiveness: 3 },
            respondent: { name: `R-${responseId}`, division: 'OPERATION', department, bagian },
        });
        // Single small department with 1 respondent (rating 2 PICs).
        const single = buildHcRecap({ pics, dimensions: DIMS, ratings: [one('s1', 'GUDANG', 'G'), { ...one('s1', 'GUDANG', 'G'), periodRateeId: 'b' }] });
        const merged = single.respondentGroups.find((entry) => entry.label === CSI_SMALL_GROUP_LABEL)!;
        expect(merged.respondents).toBe(1);
        expect(merged.all).toEqual({ average: null, ratings: 2 });
        expect(merged).not.toHaveProperty('byLocation');
        // Bagian split 3 + 1: department (4) minus L1 (3) would reveal the one L2 person, so no bagian row is shown.
        const split = buildHcRecap({ pics, dimensions: DIMS, ratings: [one('k1', 'PROD', 'L1'), one('k2', 'PROD', 'L1'), one('k3', 'PROD', 'L1'), one('k4', 'PROD', 'L2', CsiOrgLocation.SJA2)] });
        expect(split.respondentGroups.map((entry) => [entry.level, entry.label])).toEqual([['division', 'OPERATION'], ['department', 'PROD']]);
        expect(JSON.stringify(split.respondentGroups)).not.toMatch(/Bagian kecil/);
    });

    it('respondent recap has no per-location cells (a masked location would be derivable from the total)', () => {
        const one = (responseId: string, location: CsiOrgLocation, bagian = 'QC'): CsiHcRating => ({
            responseId, periodRateeId: 'a', location, scores: { Knowledge: 4, Responsiveness: 5 },
            respondent: { name: `R-${responseId}`, division: 'OPERATION', department: 'QUALITY CONTROL', bagian },
        });
        const recap = buildHcRecap({ pics, dimensions: DIMS, ratings: [
            one('q1', CsiOrgLocation.SJA1), one('q2', CsiOrgLocation.SJA1), one('q3', CsiOrgLocation.SJA1), one('q4', CsiOrgLocation.SJA2),
        ] });
        const department = recap.respondentGroups.find((entry) => entry.level === 'department')!;
        expect(department.all).toEqual({ average: 4.5, ratings: 4 });
        expect(department.respondents).toBe(4);
        recap.respondentGroups.forEach((row) => expect(row).not.toHaveProperty('byLocation'));
        expect(recap.respondentGroups.find((entry) => entry.level === 'bagian')).toMatchObject({ label: 'QC', all: { average: 4.5 } });
    });

    it('layanan, bagian, PIC and overall location cells under 3 respondents show no score (count kept)', () => {
        const at = (responseId: string, periodRateeId: string, location: CsiOrgLocation) => rating(responseId, periodRateeId, location, [4, 5]);
        const recap = buildHcRecap({ pics, dimensions: DIMS, ratings: [
            at('m1', 'a', CsiOrgLocation.SJA1), at('m2', 'a', CsiOrgLocation.SJA1), at('m3', 'a', CsiOrgLocation.SJA1),
            at('m4', 'a', CsiOrgLocation.SJA2), at('m4', 'b', CsiOrgLocation.SJA2),
        ] });
        const find = (key: string) => recap.services.find((entry) => entry.key === key)!;
        ['s:HCC', 'b:HCC:PAYROLL & BENEFIT', 'p:a'].forEach((key) => {
            expect(find(key).byLocation.SJA1).toEqual({ average: 4.5, ratings: 3 });
            expect(find(key).byLocation.SJA2.average).toBeNull();
        });
        // Two ratings from ONE respondent at SJA 2: still masked (respondents are counted, not ratings).
        expect(find('s:HCC').byLocation.SJA2).toEqual({ average: null, ratings: 2 });
        expect(find('p:b').byLocation.SJA2).toEqual({ average: null, ratings: 1 });
        // The row total is not a location cell: it keeps its score.
        expect(find('p:b').all).toEqual({ average: 4.5, ratings: 1 });
        expect(recap.overall.byLocation.SJA2).toEqual({ average: null, ratings: 2 });
    });

    it('labels a PIC without bagian "Tanpa bagian", never "(Tidak diketahui)"', () => {
        const loose: CsiHcPic = { periodRateeId: 'x', name: 'XENA', jobTitle: null, serviceCode: 'HCC', bagian: null, serviceFunction: null };
        const recap = buildHcRecap({ pics: [loose], dimensions: DIMS, ratings: [rating('x1', 'x', CsiOrgLocation.SJA1, [4, 4], '')] });
        expect(recap.services.find((entry) => entry.level === 'bagian')!.label).toBe('Tanpa bagian');
        expect(JSON.stringify(recap)).not.toContain('Tidak diketahui');
    });

    it('layanan rows count distinct respondents and have a key that matches across periods', () => {
        expect(row('s:HCC').respondents).toBe(2);
        expect(row('p:a').respondents).toBe(2);
        expect(recapRowKey(row('p:a'))).toBe('p:HCC:anita');
        expect(recapRowKey(row('s:HCC'))).toBe('s:HCC');
        expect(recapAverages(recap)['p:HCC:anita']).toBe(4.25);
    });

    it('previous period: master PIC first (rename / layanan move), never through a name two PICs share', () => {
        const withPic = (pic: CsiHcPic, picId: string, over: Partial<CsiHcPic> = {}) => ({ ...pic, picId, ...over });
        const before = buildHcRecap({
            dimensions: DIMS, ratings: [rating('o1', 'a', CsiOrgLocation.SJA1, [3, 3]), rating('o2', 'b', CsiOrgLocation.SJA1, [5, 5])],
            pics: [withPic(pics[0], 'P-ANITA', { name: 'ANITA LAMA' }), withPic(pics[1], 'P-BUDI', { name: 'ANITA' })],
        });
        const previous = recapAverages(before);
        expect(previous['pic:P-ANITA']).toBe(3);
        // "ANITA" was Budi's display name then: the name key points at his score, but the PIC key wins for Anita now.
        const anitaNow = { level: 'pic' as const, serviceCode: 'HCC', bagian: 'PAYROLL & BENEFIT', label: 'ANITA', picId: 'P-ANITA' };
        expect(previousOf(previous, anitaNow)).toBe(3);
        expect(previousOf(previous, { ...anitaNow, picId: null })).toBe(5);
        // Two rows named the same now: no name fallback.
        expect(previousOf(previous, { ...anitaNow, picId: null }, 2)).toBeUndefined();
        // Two PICs with the same name then: the name key is dropped.
        const twins = recapAverages(buildHcRecap({ dimensions: DIMS, ratings: [], pics: [withPic(pics[0], 'X'), withPic(pics[1], 'Y', { name: 'ANITA' })] }));
        expect(twins).not.toHaveProperty('p:HCC:anita');
        expect(twins).toHaveProperty('pic:X');
    });

    it('collapse: a division with one department is one row, a single bagian with the same numbers is dropped', () => {
        const cells = { all: { average: 4, ratings: 6 }, respondents: 6 };
        const row = (level: CsiRespondentRow['level'], label: string, division: string, department: string | null): CsiRespondentRow =>
            ({ level, key: `${level}:${label}`, label, division, department, ...cells });
        const rows = [
            row('division', 'FINANCE', 'FINANCE', null), row('department', 'AKUNTANSI', 'FINANCE', 'AKUNTANSI'), row('bagian', 'AKUNTANSI', 'FINANCE', 'AKUNTANSI'),
            row('division', 'OPERATION', 'OPERATION', null), row('department', 'GUDANG', 'OPERATION', 'GUDANG'), row('bagian', 'GUDANG', 'OPERATION', 'GUDANG'),
            row('department', 'PRODUKSI', 'OPERATION', 'PRODUKSI'), row('bagian', 'LINE 1', 'OPERATION', 'PRODUKSI'), row('bagian', 'LINE 2', 'OPERATION', 'PRODUKSI'),
        ];
        expect(collapseRespondentRows(rows).map((entry) => [entry.level, entry.label])).toEqual([
            ['division', 'FINANCE · AKUNTANSI'],
            ['division', 'OPERATION'], ['department', 'GUDANG'], ['department', 'PRODUKSI'], ['bagian', 'LINE 1'], ['bagian', 'LINE 2'],
        ]);
    });
});
