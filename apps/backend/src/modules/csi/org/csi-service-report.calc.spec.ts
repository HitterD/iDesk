import { CsiHcPic, CsiHcRating } from './csi-hc-report.calc';
import { CsiOrgLocation } from './csi-org.constants';
import { ANONYMOUS_RESPONDENT, buildServiceReport, pendingByDepartment } from './csi-service-report.calc';

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
        expect(report.respondentGroups.find((row) => row.level === 'division' && row.label === 'OPERATION')!.all.ratings).toBe(2);
        // The score itself still counts.
        expect(report.services.find((row) => row.key === 'p:rara')!.all.average).toBe(5);
    });

    it('admins (no hidden ratees) see every rater by name', () => {
        const report = buildServiceReport({ pics, ratings, dimensions: DIMS, serviceCode: 'HCD', hiddenRateeIds: new Set() });
        expect(report.respondents.map((row) => row.name)).toEqual(['Penilai r1', 'Penilai r2']);
    });
});

describe('pendingByDepartment', () => {
    it('counts pending raters per department without names, busiest first', () => {
        const rows = pendingByDepartment([
            { department: 'PRODUCTION', answered: false }, { department: 'PRODUCTION', answered: true }, { department: 'PRODUCTION', answered: false },
            { department: 'QC', answered: true }, { department: null, answered: false },
        ]);
        expect(rows).toEqual([
            { department: 'PRODUCTION', pending: 2, total: 3 },
            { department: 'Tanpa departemen', pending: 1, total: 1 },
            { department: 'QC', pending: 0, total: 1 },
        ]);
        expect(JSON.stringify(rows)).not.toMatch(/fullName|name/);
    });
});
