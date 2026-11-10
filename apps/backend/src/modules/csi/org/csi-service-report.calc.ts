import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { buildHcRecap, CsiHcPic, CsiHcRating, CsiHcRecap, CsiRecapRow, CsiRespondentDetail, ratingValue } from './csi-hc-report.calc';

/** Name shown instead of the rater on ratings the viewer may not attribute (ratings about the viewer themself). */
export const ANONYMOUS_RESPONDENT = 'Anonim';
export const NO_DEPARTMENT = 'Tanpa departemen';

export type CsiPendingDepartment = { department: string; pending: number; total: number };

/**
 * Report of one HC service (pure): the recap restricted to the service's PICs, all locations. Ratings of the
 * `hiddenRateeIds` (the viewer's own PIC rows) only show on the viewer's own PIC row (masked, see maskOwnRow) and as
 * anonymous answers without name, unit or location. Every other total (service, bagian, overall, respondent units)
 * is computed without them, so subtracting the named answers can never reveal them.
 */
export function buildServiceReport(input: {
    pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[]; serviceCode: string; hiddenRateeIds: ReadonlySet<string>; scope?: ServiceScope;
}): CsiHcRecap {
    const pics = input.pics.filter((pic) => pic.serviceCode === input.serviceCode);
    const ids = new Set(pics.map((pic) => pic.periodRateeId));
    const ratings = input.ratings.filter((rating) => ids.has(rating.periodRateeId));
    const visible = ratings.filter((rating) => !input.hiddenRateeIds.has(rating.periodRateeId));
    const hidden = ratings.filter((rating) => input.hiddenRateeIds.has(rating.periodRateeId));
    const full = buildHcRecap({ pics, ratings, dimensions: input.dimensions, scope: input.scope });
    const named = buildHcRecap({ pics, ratings: visible, dimensions: input.dimensions, scope: input.scope });
    const ownRow = new Map(full.services.filter((row) => row.level === 'pic' && input.hiddenRateeIds.has(row.key.slice(PIC_KEY_PREFIX.length)))
        .map((row) => [row.key, maskOwnRow(row)]));
    const services = named.services.map((row) => ownRow.get(row.key) ?? row);
    return { ...named, services, respondents: [...named.respondents, ...anonymousDetails(pics, hidden)] };
}

const PIC_KEY_PREFIX = 'p:';
/** Below this many ratings the viewer's own averages are hidden (same rule as "Hasil penilaian saya"). */
export const CSI_OWN_ROW_MIN_RATINGS = 3;
const EMPTY_CELL = { average: null, ratings: 0 };

/**
 * The viewer's own PIC row: no split per rater location (one rater from a location would be identifiable), and no
 * averages at all until enough people rated (the count stays visible).
 */
function maskOwnRow(row: CsiRecapRow): CsiRecapRow {
    const byLocation = Object.fromEntries(Object.keys(row.byLocation).map((code) => [code, EMPTY_CELL])) as CsiRecapRow['byLocation'];
    if (row.all.ratings >= CSI_OWN_ROW_MIN_RATINGS) return { ...row, byLocation };
    return {
        ...row, byLocation, all: { average: null, ratings: row.all.ratings },
        dimensions: Object.fromEntries(Object.keys(row.dimensions).map((label) => [label, null])),
    };
}

/** One anonymous row per rating, ordered by score then by the stars themselves: the order never follows answer time. */
function anonymousDetails(pics: CsiHcPic[], hidden: CsiHcRating[]): CsiRespondentDetail[] {
    const picOf = new Map(pics.map((pic) => [pic.periodRateeId, pic]));
    return hidden
        .map((rating) => ({ rating, average: ratingValue(rating) }))
        .sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || JSON.stringify(a.rating.scores).localeCompare(JSON.stringify(b.rating.scores)))
        .map(({ rating, average }, index) => {
            const pic = picOf.get(rating.periodRateeId);
            return {
                responseId: `anonim-${index + 1}`, name: ANONYMOUS_RESPONDENT, division: null, department: null, bagian: null, location: null,
                pics: [{ name: pic?.name ?? '-', serviceCode: pic?.serviceCode ?? null, bagian: pic?.bagian ?? null, scores: rating.scores, average }],
                average,
            };
        });
}

/** Raters still to answer per department (no names), most pending first. */
export function pendingByDepartment(raters: Array<{ department: string | null; answered: boolean }>): CsiPendingDepartment[] {
    const groups = new Map<string, CsiPendingDepartment>();
    raters.forEach((rater) => {
        const department = rater.department?.trim() || NO_DEPARTMENT;
        const row = groups.get(department) ?? { department, pending: 0, total: 0 };
        groups.set(department, { department, pending: row.pending + (rater.answered ? 0 : 1), total: row.total + 1 });
    });
    return [...groups.values()].sort((a, b) => b.pending - a.pending || a.department.localeCompare(b.department, 'id'));
}
