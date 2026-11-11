type AudienceRater = { id: string; user?: { isActive?: boolean | null; siteId?: string | null } | null };

/**
 * Whether a listed rater can actually open the survey: an active account at one of the period's sites (the respondent
 * eligibility rule) and, in a mapped period (`paired` not null), at least one pair. The SLA basis counts exactly these
 * raters, so pending lists, reminders and the status panel use the same rule.
 */
export function isRaterInAudience(rater: AudienceRater, periodSiteIds: readonly string[], paired: ReadonlySet<string> | null): boolean {
    const user = rater.user;
    if (!user?.isActive || !user.siteId || !periodSiteIds.includes(user.siteId)) return false;
    return !paired || paired.has(rater.id);
}
