import { CSI_SMALL_GROUP_LABEL } from '../csi.constants';
import { CsiHcPic, CsiHcRating } from './csi-hc-report.calc';
import { CsiOrgLocation } from './csi-org.constants';
import { ANONYMOUS_RESPONDENT, buildServiceReport, mergeSmallDepartments, pendingByDepartment } from './csi-service-report.calc';

const DIMS = ['Knowledge'];
const pics: CsiHcPic[] = [
    { periodRateeId: 'rara', name: 'RARA', jobTitle: 'Staff', serviceCode: 'HCD', bagian: 'HCD', serviceFunction: 'People & Organization Development' },
    { periodRateeId: 'pris', name: 'PRISCILLA', jobTitle: 'Supervisor', serviceCode: 'HCD', bagian: 'HCD', serviceFunction: null },
    { periodRateeId: 'mega', name: 'MEGA', jobTitle: 'Supervisor', serviceCode: 'HCC', bagian: 'HCC', serviceFunction: null },
];
const rating = (responseId: string, periodRateeId: string, score: number, location = CsiOrgLocation.SJA4): CsiHcRating => ({
    responseId, periodRateeId, location, scores: { Knowledge: score },
    respondent: { name: `Penilai ${responseId}`, division: 'OPERATION', department: 'PRODUCTION', bagian: 'RTD' },
});
const ratings = [rating('r1', 'rara', 5), rating('r1', 'pris', 4), rating('r2', 'pris', 3, CsiOrgLocation.SJA1), rating('r3', 'mega', 2)];

describe('buildServiceReport', () => {
    it('keeps only the PICs and ratings of the requested service, every location', () => {
        const report = buildServiceReport({ pics, ratings, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set() });
        expect(report.services.filter((row) => row.level === 'pic').map((row) => row.label)).toEqual(['PRISCILLA', 'RARA']);
        expect(report.overall.all.ratings).toBe(3);
        expect(report.overall.byLocation.SJA1.ratings).toBe(1);
        expect(JSON.stringify(report)).not.toContain('MEGA');
    });

    it('rates about the viewer themselves are anonymous: no name, no unit, separate row', () => {
        const report = buildServiceReport({ pics, ratings, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set(['rara']) });
        const named = report.respondents.find((row) => row.name === 'Penilai r1')!;
        expect(named.pics.map((pic) => pic.name)).toEqual(['PRISCILLA']);
        const anonymous = report.respondents.filter((row) => row.name === ANONYMOUS_RESPONDENT);
        expect(anonymous).toHaveLength(1);
        expect(anonymous[0]).toMatchObject({ division: null, department: null, bagian: null, location: null });
        expect(anonymous[0].pics.map((pic) => [pic.name, pic.average])).toEqual([['RARA', 5]]);
        expect(anonymous[0].responseId).not.toBe('r1');
        // The unit breakdown cannot point at the rater either.
        // (2 respondents < CSI_ANON_MIN_GROUP: their unit only shows inside the merged small-department row.)
        expect(report.respondentGroups.map((row) => [row.label, row.all.ratings])).toEqual([[CSI_SMALL_GROUP_LABEL, 2]]);
        // The service total leaves them out (otherwise total − named answers reveals them).
        expect(report.services.find((row) => row.key === 's:HCD')!.all.ratings).toBe(2);
    });

    it('the viewer own PIC row shows no location split, and nothing at all below 3 ratings', () => {
        const few = buildServiceReport({ pics, ratings, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set(['rara']) });
        const own = few.services.find((row) => row.key === 'p:rara')!;
        expect(Object.values(own.byLocation).every((cell) => cell.average === null && cell.ratings === 0)).toBe(true);
        expect(own.all).toEqual({ average: null, ratings: 1 });
        expect(own.dimensions).toEqual({ Knowledge: null });
        const many = [...ratings, rating('r4', 'rara', 3), rating('r5', 'rara', 4, CsiOrgLocation.SJA1)];
        const enough = buildServiceReport({ pics, ratings: many, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set(['rara']) });
        const ownEnough = enough.services.find((row) => row.key === 'p:rara')!;
        expect(ownEnough.all).toEqual({ average: 4, ratings: 3 });
        expect(ownEnough.dimensions).toEqual({ Knowledge: 4 });
        expect(ownEnough.byLocation.SJA1).toEqual({ average: null, ratings: 0 });
        expect(enough.services.find((row) => row.key === 'p:pris')!.byLocation.SJA1.ratings).toBe(1);
    });

    it('service, bagian and overall exclude the viewer own ratings, so they cannot be worked back out', () => {
        const many = [...ratings, rating('r4', 'rara', 1), rating('r5', 'rara', 2, CsiOrgLocation.SJA1)];
        const report = buildServiceReport({ pics, ratings: many, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set(['rara']) });
        const visibleOnly = buildServiceReport({ pics: pics.filter((pic) => pic.periodRateeId !== 'rara'), ratings: many.filter((r) => r.periodRateeId !== 'rara'), dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set() });
        for (const key of ['s:HCD', 'b:HCD:HCD']) {
            const row = report.services.find((entry) => entry.key === key)!;
            const expected = visibleOnly.services.find((entry) => entry.key === key)!;
            expect([row.all, row.byLocation, row.dimensions]).toEqual([expected.all, expected.byLocation, expected.dimensions]);
        }
        expect(report.overall.all).toEqual(visibleOnly.overall.all);
        expect(report.overall.byLocation).toEqual(visibleOnly.overall.byLocation);
        // Own row keeps its own total once there are 3 ratings (same rule as "Hasil penilaian saya").
        expect(report.services.find((row) => row.key === 'p:rara')!.all).toEqual({ average: 2.67, ratings: 3 });
    });

    it('anonymous rows with equal averages are not in answer order', () => {
        const same = [rating('z9', 'rara', 4), rating('a1', 'rara', 4), rating('m5', 'rara', 4)].map((entry, index) => ({ ...entry, scores: { Knowledge: 4 - index, Extra: index } }));
        const report = buildServiceReport({ pics, ratings: same, dimensions: ['Knowledge', 'Extra'], serviceCode: 'HCD', hiddenRateeIds: new Set(['rara']) });
        const extras = report.respondents.filter((row) => row.name === ANONYMOUS_RESPONDENT).map((row) => row.pics[0].scores.Extra);
        expect(extras).toEqual([2, 1, 0]);
    });

    it('admins (no hidden ratees) see every rater by name', () => {
        const report = buildServiceReport({ pics, ratings, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set() });
        expect(report.respondents.map((row) => row.name)).toEqual(['Penilai r1', 'Penilai r2']);
    });
});

describe('pendingByDepartment', () => {
    const raters = [
        { department: 'PRODUCTION', answered: false }, { department: 'PRODUCTION', answered: true }, { department: 'PRODUCTION', answered: false },
        { department: 'QC', answered: true }, { department: null, answered: false },
    ];

    it('service report: departments under 3 raters are merged into "Departemen kecil (gabungan)"', () => {
        const rows = mergeSmallDepartments(pendingByDepartment(raters));
        expect(rows).toEqual([
            { department: 'PRODUCTION', pending: 2, total: 3 },
            { department: CSI_SMALL_GROUP_LABEL, pending: 1, total: 2 },
        ]);
        expect(JSON.stringify(rows)).not.toMatch(/QC|Tanpa departemen/);
        expect(mergeSmallDepartments([{ department: 'A', pending: 1, total: 3 }])).toEqual([{ department: 'A', pending: 1, total: 3 }]);
    });

    it('counts pending raters per department without names, busiest first', () => {
        const rows = pendingByDepartment(raters);
        expect(rows).toEqual([
            { department: 'PRODUCTION', pending: 2, total: 3 },
            { department: 'Tanpa departemen', pending: 1, total: 1 },
            { department: 'QC', pending: 0, total: 1 },
        ]);
        expect(JSON.stringify(rows)).not.toMatch(/fullName|name/);
    });
});
