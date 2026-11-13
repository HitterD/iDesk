import { CSI_SCORE_MAX, CSI_SCORE_MIN, CsiQuestionType } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { averageOfAverages, responseAverage } from './csi-score.util';

const PERCENT = 100;
const INDEX_DECIMALS = 10;
const SCORED_TYPES = new Set([CsiQuestionType.STAR, CsiQuestionType.SCALE]);

export type CsiItemRow = Pick<CsiResponseItem, 'responseId' | 'periodRateeId' | 'periodRateeDimensionId' | 'score' | 'answerLabel'> & { answerText?: string | null };
export type CsiDistributionBucket = { label: string; count: number };
export type CsiQuestionStat = {
    name: string; shortLabel: string | null;
    /** Master question description (e.g. "[Kecepatan respon ...]"); null when absent or the `dimension` relation is not loaded. */
    description: string | null;
    type: CsiQuestionType; average: number | null; count: number; distribution: CsiDistributionBucket[];
};

const countBy = <T>(rows: T[], key: (row: T) => string): Map<string, number> => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(key(row), (counts.get(key(row)) ?? 0) + 1));
    return counts;
};

/** Per-response averages: groups items by response and averages their non-null scores. */
export function responseAverages(items: CsiItemRow[]): Array<number | null> {
    const byResponse = new Map<string, Array<number | null>>();
    items.forEach((item) => byResponse.set(item.responseId, [...(byResponse.get(item.responseId) ?? []), item.score]));
    return [...byResponse.values()].map(responseAverage);
}

/** Answer distribution per question type: STAR 1..5, SCALE/CHOICE the snapshot options, TEXT none. */
function distributionOf(dimension: CsiPeriodRateeDimension, items: CsiItemRow[]): CsiDistributionBucket[] {
    if (dimension.type === CsiQuestionType.TEXT) {
        const counts = countBy(items.filter((item) => item.answerText?.trim()), (item) => item.answerText!.trim());
        return [...counts].map(([label, count]) => ({ label, count }));
    }
    if (dimension.type === CsiQuestionType.STAR) {
        const counts = countBy(items, (item) => String(item.score));
        return Array.from({ length: CSI_SCORE_MAX - CSI_SCORE_MIN + 1 }, (_, index) => {
            const label = String(CSI_SCORE_MIN + index);
            return { label, count: counts.get(label) ?? 0 };
        });
    }
    const counts = countBy(items, (item) => item.answerLabel ?? '');
    return (dimension.options ?? []).map((option) => ({ label: option.label, count: counts.get(option.label) ?? 0 }));
}

/** One question's stats; the average is null (never 0) when it has no scored answer (CHOICE/TEXT or unanswered). */
export function questionStat(dimension: CsiPeriodRateeDimension, items: CsiItemRow[]): CsiQuestionStat {
    const own = items.filter((item) => item.periodRateeDimensionId === dimension.id);
    const scores = own.map((item) => item.score).filter((score): score is number => score !== null && score !== undefined);
    return {
        name: dimension.dimensionName, shortLabel: dimension.shortLabel ?? null, description: dimension.dimension?.description ?? null, type: dimension.type ?? CsiQuestionType.STAR,
        average: responseAverage(scores), count: scores.length, distribution: distributionOf(dimension, own),
    };
}

/** Counts of scored STAR/SCALE answers per rounded value 1..5 (index 0 = 1 star). */
export function starDistribution(dimensions: CsiPeriodRateeDimension[], items: CsiItemRow[]): number[] {
    const scored = new Set(dimensions
        .filter((dimension) => SCORED_TYPES.has(dimension.type ?? CsiQuestionType.STAR))
        .map((dimension) => dimension.id));
    const counts = Array.from({ length: CSI_SCORE_MAX - CSI_SCORE_MIN + 1 }, () => 0);
    items.forEach((item) => {
        if (item.score === null || item.score === undefined || !scored.has(item.periodRateeDimensionId)) return;
        const value = Math.min(CSI_SCORE_MAX, Math.max(CSI_SCORE_MIN, Math.round(item.score)));
        counts[value - CSI_SCORE_MIN] += 1;
    });
    return counts;
}

/** Resolved display profile of a ratee (period override -> master); defaults to the period row. */
export type CsiRateeDisplay = { siteId: string | null; photoUrl: string | null };

/** Ratee report row: average = mean of each respondent's own average over this ratee's questions. */
export function rateeStats(ratee: CsiPeriodRatee, dimensions: CsiPeriodRateeDimension[], allItems: CsiItemRow[], display?: CsiRateeDisplay) {
    const items = allItems.filter((item) => item.periodRateeId === ratee.id);
    const own = dimensions.filter((dimension) => dimension.periodRateeId === ratee.id);
    const average = averageOfAverages(responseAverages(items));
    return {
        periodRateeId: ratee.id, kind: ratee.kind, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
        // Layanan / bagian / fungsi snapshot (HC PICs and custom teams; ICT people carry their layanan): report ranking.
        serviceCode: ratee.serviceCode ?? null, bagian: ratee.bagian ?? null, serviceFunction: ratee.serviceFunction ?? null,
        /** Master PIC (HC): the same person across periods, whatever the name snapshot. */
        picId: ratee.picId ?? null,
        siteId: display ? display.siteId : ratee.siteId ?? null,
        photoUrl: display ? display.photoUrl : ratee.photoUrl ?? null,
        respondentCount: new Set(items.map((item) => item.responseId)).size,
        average,
        indexPct: average === null ? null : Math.round((average / CSI_SCORE_MAX) * PERCENT * INDEX_DECIMALS) / INDEX_DECIMALS,
        starDistribution: starDistribution(own, items),
        questions: own.map((dimension) => questionStat(dimension, items)),
    };
}

/** Site filter: items of ratees in the site(s), answered by respondents of those site(s). */
export function itemsForSite<T extends Pick<CsiItemRow, 'responseId' | 'periodRateeId'>>(
    items: T[],
    rateeSite: Map<string, string | null>,
    responseSite: Map<string, string | null>,
    rateeSites: string | ReadonlySet<string>,
    responseSites: string | ReadonlySet<string> = rateeSites,
): T[] {
    const hasRatee = typeof rateeSites === 'string'
        ? (id: string | null | undefined) => id === rateeSites
        : (id: string | null | undefined) => !!id && rateeSites.has(id);
    const hasResponse = typeof responseSites === 'string'
        ? (id: string | null | undefined) => id === responseSites
        : (id: string | null | undefined) => !!id && responseSites.has(id);
    return items.filter((item) => hasRatee(rateeSite.get(item.periodRateeId)) && hasResponse(responseSite.get(item.responseId)));
}

/**
 * HC survey average (same basis as the per-PIC recap): one rating = one respondent's scored answers about one subject,
 * valued at their mean; the average is the mean of those ratings, so every (respondent, subject) pair weighs the same.
 */
export function ratingAverage(items: CsiItemRow[]): { average: number | null; ratings: number } {
    const byRating = new Map<string, Array<number | null>>();
    items.forEach((item) => {
        const key = `${item.responseId}\u0000${item.periodRateeId}`;
        byRating.set(key, [...(byRating.get(key) ?? []), item.score]);
    });
    const values = [...byRating.values()].map(responseAverage).filter((value): value is number => value !== null);
    return { average: averageOfAverages(values), ratings: values.length };
}

/** Survey average: mean over responses of the average of ALL scored items of that response. */
export function overallStats(items: CsiItemRow[], respondentCount: number) {
    return { average: averageOfAverages(responseAverages(items)), respondentCount };
}
