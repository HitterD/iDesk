import { CSI_LOCATIONS, CSI_UNKNOWN_LABEL, CsiOrgLocation, serviceName } from './csi-org.constants';

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
export type CsiHcPic = { periodRateeId: string; name: string; jobTitle: string | null; serviceCode: string | null; bagian: string | null };

/** Average per location column plus ALL SJA, with the number of ratings behind each. */
export type CsiLocationCells = { all: CsiCell; byLocation: Record<CsiOrgLocation, CsiCell> };
export type CsiCell = { average: number | null; ratings: number };
export type CsiRecapRow = CsiLocationCells & {
    level: 'service' | 'bagian' | 'pic';
    key: string; label: string; serviceCode: string | null; bagian: string | null; jobTitle: string | null;
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

/** Layanan → bagian → PIC rows (PICs without any rating are listed too, with empty cells). */
function serviceRows(pics: CsiHcPic[], ratings: CsiHcRating[], dimensions: string[]): CsiRecapRow[] {
    const byPic = groupBy(ratings, (rating) => rating.periodRateeId);
    const rows: CsiRecapRow[] = [];
    const services = groupBy(pics, (pic) => pic.serviceCode ?? '');
    [...services.keys()].sort().forEach((serviceCode) => {
        const servicePics = services.get(serviceCode)!;
        const serviceRatings = servicePics.flatMap((pic) => byPic.get(pic.periodRateeId) ?? []);
        rows.push({
            level: 'service', key: `s:${serviceCode}`, label: serviceCode ? `${serviceCode} · ${serviceName(serviceCode) ?? ''}`.trim() : CSI_UNKNOWN_LABEL,
            serviceCode: serviceCode || null, bagian: null, jobTitle: null, ...cells(serviceRatings), dimensions: dimensionAverages(serviceRatings, dimensions),
        });
        const bagians = groupBy(servicePics, (pic) => pic.bagian ?? '');
        [...bagians.keys()].sort().forEach((bagian) => {
            const bagianPics = [...bagians.get(bagian)!].sort((a, b) => a.name.localeCompare(b.name, 'id'));
            const bagianRatings = bagianPics.flatMap((pic) => byPic.get(pic.periodRateeId) ?? []);
            rows.push({
                level: 'bagian', key: `b:${serviceCode}:${bagian}`, label: label(bagian), serviceCode: serviceCode || null, bagian: bagian || null,
                jobTitle: null, ...cells(bagianRatings), dimensions: dimensionAverages(bagianRatings, dimensions),
            });
            bagianPics.forEach((pic) => {
                const own = byPic.get(pic.periodRateeId) ?? [];
                rows.push({
                    level: 'pic', key: `p:${pic.periodRateeId}`, label: pic.name, serviceCode: serviceCode || null, bagian: bagian || null,
                    jobTitle: pic.jobTitle, ...cells(own), dimensions: dimensionAverages(own, dimensions),
                });
            });
        });
    });
    return rows;
}

/** Respondent division → department → bagian rows (scores they gave, over all PICs). */
function respondentRows(ratings: CsiHcRating[]): CsiRespondentRow[] {
    const rows: CsiRespondentRow[] = [];
    const divisions = groupBy(ratings, (rating) => label(rating.respondent.division));
    [...divisions.keys()].sort().forEach((division) => {
        const divisionRatings = divisions.get(division)!;
        rows.push({ level: 'division', key: `d:${division}`, label: division, division, department: null, ...cells(divisionRatings) });
        const departments = groupBy(divisionRatings, (rating) => label(rating.respondent.department));
        [...departments.keys()].sort().forEach((department) => {
            const departmentRatings = departments.get(department)!;
            rows.push({ level: 'department', key: `dp:${division}:${department}`, label: department, division, department, ...cells(departmentRatings) });
            const bagians = groupBy(departmentRatings, (rating) => label(rating.respondent.bagian));
            [...bagians.keys()].sort().forEach((bagian) => {
                rows.push({ level: 'bagian', key: `bg:${division}:${department}:${bagian}`, label: bagian, division, department, ...cells(bagians.get(bagian)!) });
            });
        });
    });
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

export function buildHcRecap(input: { pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[] }): CsiHcRecap {
    const { pics, ratings, dimensions } = input;
    return {
        dimensions, locations: [...CSI_LOCATIONS],
        overall: { ...cells(ratings), dimensions: dimensionAverages(ratings, dimensions), respondents: new Set(ratings.map((rating) => rating.responseId)).size },
        services: serviceRows(pics, ratings, dimensions),
        respondentGroups: respondentRows(ratings),
        respondents: respondentDetails(pics, ratings),
    };
}
