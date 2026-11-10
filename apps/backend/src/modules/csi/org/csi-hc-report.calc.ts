import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CSI_ANON_MIN_GROUP, CSI_SMALL_GROUP_LABEL } from '../csi.constants';
import { CSI_LOCATIONS, CSI_UNKNOWN_LABEL, CsiOrgLocation } from './csi-org.constants';
import { serviceNameOf } from './csi-services';

/**
 * HC per-PIC recap (pure). The unit is one rating = one respondent's stars for one PIC; its value is the average of
 * the scored answers (the 5 dimensions). Every average below is the mean of the ratings it covers, so a service or
 * bagian score weighs every rating equally, and a dimension average is the mean of that question's stars.
 */
export type CsiHcRating = {
    responseId: string; periodRateeId: string; location: string | null;
    respondent: { name: string; division: string | null; department: string | null; bagian: string | null };
    /** Stars per dimension label, e.g. { Knowledge: 5 }. */
    scores: Record<string, number>;
};
export type CsiHcPic = { periodRateeId: string; name: string; jobTitle: string | null; serviceCode: string | null; bagian: string | null; serviceFunction: string | null };

/** Average per location column plus ALL SJA, with the number of ratings behind each. */
export type CsiLocationCells = { all: CsiCell; byLocation: Record<CsiOrgLocation, CsiCell> };
export type CsiCell = { average: number | null; ratings: number };
export type CsiRecapRow = CsiLocationCells & {
    level: 'service' | 'bagian' | 'pic';
    key: string; label: string; serviceCode: string | null; bagian: string | null; jobTitle: string | null;
    /** Fungsi pelayanan (PIC rows only). */
    serviceFunction: string | null;
    /** Dimension averages (ALL SJA). */
    dimensions: Record<string, number | null>;
};
export type CsiRespondentRow = CsiLocationCells & { level: 'division' | 'department' | 'bagian'; key: string; label: string; division: string; department: string | null };
export type CsiRespondentDetail = {
    responseId: string; name: string; division: string | null; department: string | null; bagian: string | null; location: string | null;
    pics: Array<{ name: string; serviceCode: string | null; bagian: string | null; scores: Record<string, number>; average: number | null }>;
    average: number | null;
};
export type CsiHcRecap = {
    dimensions: string[]; locations: Array<{ code: CsiOrgLocation; label: string }>;
    overall: CsiLocationCells & { dimensions: Record<string, number | null>; respondents: number };
    services: CsiRecapRow[];
    respondentGroups: CsiRespondentRow[];
    respondents: CsiRespondentDetail[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const mean = (values: number[]) => (values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : null);
export const ratingValue = (rating: Pick<CsiHcRating, 'scores'>) => mean(Object.values(rating.scores));

function cells(ratings: CsiHcRating[]): CsiLocationCells {
    const values = (rows: CsiHcRating[]) => rows.map(ratingValue).filter((value): value is number => value !== null);
    const byLocation = Object.fromEntries(CSI_LOCATIONS.map(({ code }) => {
        const rows = ratings.filter((rating) => rating.location === code);
        return [code, { average: mean(values(rows)), ratings: rows.length }];
    })) as Record<CsiOrgLocation, CsiCell>;
    return { all: { average: mean(values(ratings)), ratings: ratings.length }, byLocation };
}

function dimensionAverages(ratings: CsiHcRating[], dimensions: string[]) {
    return Object.fromEntries(dimensions.map((label) => [label,
        mean(ratings.map((rating) => rating.scores[label]).filter((value): value is number => value !== undefined))]));
}

const groupBy = <T>(rows: T[], key: (row: T) => string) => {
    const groups = new Map<string, T[]>();
    rows.forEach((row) => groups.set(key(row), [...(groups.get(key(row)) ?? []), row]));
    return groups;
};
const label = (value: string | null | undefined) => value || CSI_UNKNOWN_LABEL;
/** Row that holds the bagians of a department below CSI_ANON_MIN_GROUP respondents. */
export const CSI_SMALL_BAGIAN_LABEL = 'Bagian kecil (gabungan)';

/** Layanan → bagian → PIC rows (PICs without any rating are listed too, with empty cells). */
function serviceRows(pics: CsiHcPic[], ratings: CsiHcRating[], dimensions: string[], scope: ServiceScope): CsiRecapRow[] {
    const byPic = groupBy(ratings, (rating) => rating.periodRateeId);
    const rows: CsiRecapRow[] = [];
    const services = groupBy(pics, (pic) => pic.serviceCode ?? '');
    [...services.keys()].sort().forEach((serviceCode) => {
        const servicePics = services.get(serviceCode)!;
        const serviceRatings = servicePics.flatMap((pic) => byPic.get(pic.periodRateeId) ?? []);
        rows.push({
            level: 'service', key: `s:${serviceCode}`, label: serviceCode ? `${serviceCode} · ${serviceNameOf(scope, serviceCode) ?? ''}`.trim() : CSI_UNKNOWN_LABEL,
            serviceCode: serviceCode || null, bagian: null, jobTitle: null, serviceFunction: null, ...cells(serviceRatings), dimensions: dimensionAverages(serviceRatings, dimensions),
        });
        const bagians = groupBy(servicePics, (pic) => pic.bagian ?? '');
        [...bagians.keys()].sort().forEach((bagian) => {
            const bagianPics = [...bagians.get(bagian)!].sort((a, b) => a.name.localeCompare(b.name, 'id'));
            const bagianRatings = bagianPics.flatMap((pic) => byPic.get(pic.periodRateeId) ?? []);
            rows.push({
                level: 'bagian', key: `b:${serviceCode}:${bagian}`, label: label(bagian), serviceCode: serviceCode || null, bagian: bagian || null,
                jobTitle: null, serviceFunction: null, ...cells(bagianRatings), dimensions: dimensionAverages(bagianRatings, dimensions),
            });
            bagianPics.forEach((pic) => {
                const own = byPic.get(pic.periodRateeId) ?? [];
                rows.push({
                    level: 'pic', key: `p:${pic.periodRateeId}`, label: pic.name, serviceCode: serviceCode || null, bagian: bagian || null,
                    jobTitle: pic.jobTitle, serviceFunction: pic.serviceFunction, ...cells(own), dimensions: dimensionAverages(own, dimensions),
                });
            });
        });
    });
    return rows;
}

const respondentsOf = (ratings: CsiHcRating[]) => new Set(ratings.map((rating) => rating.responseId)).size;
const isSmall = (ratings: CsiHcRating[]) => respondentsOf(ratings) < CSI_ANON_MIN_GROUP;

/** Bagian rows of one department; bagians below CSI_ANON_MIN_GROUP respondents share one merged row. */
function bagianRows(ratings: CsiHcRating[], division: string, department: string): CsiRespondentRow[] {
    const bagians = groupBy(ratings, (rating) => label(rating.respondent.bagian));
    const row = (name: string, own: CsiHcRating[]): CsiRespondentRow => ({ level: 'bagian', key: `bg:${division}:${department}:${name}`, label: name, division, department, ...cells(own) });
    const small = [...bagians.values()].filter(isSmall).flat();
    const rows = [...bagians.keys()].sort().filter((bagian) => !isSmall(bagians.get(bagian)!)).map((bagian) => row(bagian, bagians.get(bagian)!));
    return small.length ? [...rows, row(CSI_SMALL_BAGIAN_LABEL, small)] : rows;
}

/**
 * Respondent division → department → bagian rows (scores they gave, over all PICs). Departments below
 * CSI_ANON_MIN_GROUP respondents leave their division (so no total minus the rest reveals them) and are summed in one
 * "Departemen kecil (gabungan)" row at the end.
 */
function respondentRows(ratings: CsiHcRating[]): CsiRespondentRow[] {
    const departmentKey = (rating: CsiHcRating) => `${label(rating.respondent.division)}\u0000${label(rating.respondent.department)}`;
    const byDepartment = groupBy(ratings, departmentKey);
    const small = [...byDepartment.values()].filter(isSmall).flat();
    const kept = [...byDepartment.values()].filter((own) => !isSmall(own)).flat();
    const rows: CsiRespondentRow[] = [];
    const divisions = groupBy(kept, (rating) => label(rating.respondent.division));
    [...divisions.keys()].sort().forEach((division) => {
        const divisionRatings = divisions.get(division)!;
        rows.push({ level: 'division', key: `d:${division}`, label: division, division, department: null, ...cells(divisionRatings) });
        const departments = groupBy(divisionRatings, (rating) => label(rating.respondent.department));
        [...departments.keys()].sort().forEach((department) => {
            const departmentRatings = departments.get(department)!;
            rows.push({ level: 'department', key: `dp:${division}:${department}`, label: department, division, department, ...cells(departmentRatings) });
            rows.push(...bagianRows(departmentRatings, division, department));
        });
    });
    if (small.length) rows.push({ level: 'division', key: 'd:small', label: CSI_SMALL_GROUP_LABEL, division: CSI_SMALL_GROUP_LABEL, department: null, ...cells(small) });
    return rows;
}

function respondentDetails(pics: CsiHcPic[], ratings: CsiHcRating[]): CsiRespondentDetail[] {
    const picOf = new Map(pics.map((pic) => [pic.periodRateeId, pic]));
    return [...groupBy(ratings, (rating) => rating.responseId).values()].map((own) => {
        const first = own[0];
        const picRows = own.map((rating) => {
            const pic = picOf.get(rating.periodRateeId);
            return { name: pic?.name ?? '-', serviceCode: pic?.serviceCode ?? null, bagian: pic?.bagian ?? null, scores: rating.scores, average: ratingValue(rating) };
        }).sort((a, b) => (a.serviceCode ?? '').localeCompare(b.serviceCode ?? '') || a.name.localeCompare(b.name, 'id'));
        return {
            responseId: first.responseId, name: first.respondent.name, division: first.respondent.division, department: first.respondent.department,
            bagian: first.respondent.bagian, location: first.location, pics: picRows,
            average: mean(own.map(ratingValue).filter((value): value is number => value !== null)),
        };
    }).sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** `scope` names the layanan rows (HC departments or ICT teams); HC when omitted. */
export function buildHcRecap(input: { pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[]; scope?: ServiceScope }): CsiHcRecap {
    const { pics, ratings, dimensions } = input;
    const scope = input.scope ?? ServiceScope.HC;
    return {
        dimensions, locations: [...CSI_LOCATIONS],
        overall: { ...cells(ratings), dimensions: dimensionAverages(ratings, dimensions), respondents: new Set(ratings.map((rating) => rating.responseId)).size },
        services: serviceRows(pics, ratings, dimensions, scope),
        respondentGroups: respondentRows(ratings),
        respondents: respondentDetails(pics, ratings),
    };
}
