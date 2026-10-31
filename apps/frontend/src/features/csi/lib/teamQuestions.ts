import type { CsiPeriodDetail, CsiPeriodRatee } from '../types';

/** The TEAM ratee of one period site (one team per site), if any. */
export const siteTeamRatee = (period: CsiPeriodDetail, siteId: string): CsiPeriodRatee | undefined =>
    period.ratees.find((ratee) => ratee.kind === 'TEAM' && ratee.siteId === siteId);

/** Question ids of the site's TEAM ratee in saved order (empty when there is none). */
export const teamQuestionIds = (period: CsiPeriodDetail, siteId: string): string[] =>
    [...(siteTeamRatee(period, siteId)?.dimensions ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder).map((dimension) => dimension.dimensionId);

export const sameOrder = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);
