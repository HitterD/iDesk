import type { CsiSiteSummary } from '../types';

const EMPTY = '—';
const SEPARATOR = ' & ';

/** Compact label by site code: "ICT & HC"-style, used in lists and headers. */
export const formatSites = (sites: readonly CsiSiteSummary[]) =>
    sites.map((site) => site.code).filter(Boolean).join(SEPARATOR) || EMPTY;

/** Full site names (code when a name is missing), used in the review summary. */
export const formatSiteNames = (sites: readonly CsiSiteSummary[]) =>
    sites.map((site) => site.name ?? site.code).filter(Boolean).join(SEPARATOR) || EMPTY;
