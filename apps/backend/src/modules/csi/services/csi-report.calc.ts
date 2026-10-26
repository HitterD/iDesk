import { CSI_SCORE_MAX, CSI_SCORE_MIN, CsiQuestionType } from '../csi.constants';
import { CsiPeriodRateeDimension } from '../entities/csi-period-ratee-dimension.entity';
import { CsiPeriodRatee } from '../entities/csi-period-ratee.entity';
import { CsiResponseItem } from '../entities/csi-response-item.entity';
import { averageOfAverages, responseAverage } from './csi-score.util';

const PERCENT = 100;
const INDEX_DECIMALS = 10;

export type CsiItemRow = Pick<CsiResponseItem, 'responseId' | 'periodRateeId' | 'periodRateeDimensionId' | 'score' | 'answerLabel'>;
export type CsiDistributionBucket = { label: string; count: number };
export type CsiQuestionStat = {
    name: string; type: CsiQuestionType; average: number | null; count: number; distribution: CsiDistributionBucket[];
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
    if (dimension.type === CsiQuestionType.TEXT) return [];
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
        name: dimension.dimensionName, type: dimension.type ?? CsiQuestionType.STAR,
        average: responseAverage(scores), count: scores.length, distribution: distributionOf(dimension, own),
    };
}

/** Ratee report row: average = mean of each respondent's own average over this ratee's questions. */
export function rateeStats(ratee: CsiPeriodRatee, dimensions: CsiPeriodRateeDimension[], allItems: CsiItemRow[]) {
    const items = allItems.filter((item) => item.periodRateeId === ratee.id);
    const average = averageOfAverages(responseAverages(items));
    return {
        periodRateeId: ratee.id, kind: ratee.kind, displayName: ratee.displayName, jobTitle: ratee.jobTitle,
        respondentCount: new Set(items.map((item) => item.responseId)).size,
        average,
        indexPct: average === null ? null : Math.round((average / CSI_SCORE_MAX) * PERCENT * INDEX_DECIMALS) / INDEX_DECIMALS,
        questions: dimensions.filter((dimension) => dimension.periodRateeId === ratee.id).map((dimension) => questionStat(dimension, items)),
    };
}

/** Survey average: mean over responses of the average of ALL scored items of that response. */
export function overallStats(items: CsiItemRow[], respondentCount: number) {
    return { average: averageOfAverages(responseAverages(items)), respondentCount };
}
