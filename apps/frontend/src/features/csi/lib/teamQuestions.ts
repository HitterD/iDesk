import type { CsiPeriodDetail } from '../types';

/** Question ids of the period's TEAM ratee in saved order (empty when there is none). */
export const teamQuestionIds = (period: CsiPeriodDetail): string[] =>
    [...(period.ratees.find((ratee) => ratee.kind === 'TEAM')?.dimensions ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder).map((dimension) => dimension.dimensionId);

export const sameOrder = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);
