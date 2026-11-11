type AudienceRater = { id: string; user?: { isActive?: boolean | null; siteId?: string | null } | null };

/**
 * Whether a listed rater belongs to the survey audience: an active account at one of the period's sites and, in a
 * mapped period (`paired` not null), at least one pair. Mirrors the SLA basis (CsiSlaService.listedReporters), so
 * pending lists, reminders and the status panel count the same people. It does not model per-pair visibility (a pair
 * whose ratee is hidden, e.g. the rater themself or a disabled section); the respondent form decides that per subject.
 */
export function isRaterInAudience(rater: AudienceRater, periodSiteIds: readonly string[], paired: ReadonlySet<string> | null): boolean {
    const user = rater.user;
    if (!user?.isActive || !user.siteId || !periodSiteIds.includes(user.siteId)) return false;
    return !paired || paired.has(rater.id);
}
