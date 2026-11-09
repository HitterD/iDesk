import { buildHcRecap, CsiHcPic, CsiHcRating, CsiHcRecap, CsiRespondentDetail, ratingValue } from './csi-hc-report.calc';

/** Name shown instead of the rater on ratings the viewer may not attribute (ratings about the viewer themself). */
export const ANONYMOUS_RESPONDENT = 'Anonim';
const NO_DEPARTMENT = 'Tanpa departemen';

export type CsiPendingDepartment = { department: string; pending: number; total: number };

/**
 * Report of one HC service (pure): the recap restricted to the service's PICs, all locations. Ratings of the
 * `hiddenRateeIds` (the viewer's own PIC rows) still count in every score, but are left out of the respondent unit
 * breakdown and listed as separate anonymous answers without name, unit or location.
 */
export function buildServiceReport(input: {
    pics: CsiHcPic[]; ratings: CsiHcRating[]; dimensions: string[]; serviceCode: string; hiddenRateeIds: ReadonlySet<string>;
}): CsiHcRecap {
    const pics = input.pics.filter((pic) => pic.serviceCode === input.serviceCode);
    const ids = new Set(pics.map((pic) => pic.periodRateeId));
    const ratings = input.ratings.filter((rating) => ids.has(rating.periodRateeId));
    const visible = ratings.filter((rating) => !input.hiddenRateeIds.has(rating.periodRateeId));
    const hidden = ratings.filter((rating) => input.hiddenRateeIds.has(rating.periodRateeId));
    const full = buildHcRecap({ pics, ratings, dimensions: input.dimensions });
    const named = buildHcRecap({ pics, ratings: visible, dimensions: input.dimensions });
    return { ...full, respondentGroups: named.respondentGroups, respondents: [...named.respondents, ...anonymousDetails(pics, hidden)] };
}

/** One anonymous row per rating, ordered by score so the order says nothing about who answered first. */
function anonymousDetails(pics: CsiHcPic[], hidden: CsiHcRating[]): CsiRespondentDetail[] {
    const picOf = new Map(pics.map((pic) => [pic.periodRateeId, pic]));
    return hidden
        .map((rating) => ({ rating, average: ratingValue(rating) }))
        .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
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
