import type { CsiScopeParam, CsiSiteSummary } from '../types';

/** Builds a site handler lookup (`childSiteId -> handlerSiteId`) from period sites (ICT only). */
export function siteHandlerMapOf(scope: CsiScopeParam, sites: readonly CsiSiteSummary[]): Record<string, string> {
    if (scope !== 'ict') return {};
    const map: Record<string, string> = {};
    for (const site of sites) {
        if (site.handledBySiteId) map[site.id] = site.handledBySiteId;
    }
    return map;
}

/** Resolves the effective site handling a given site (`SKD -> SPJ` when `siteHandlers` maps it). */
export function resolveEffectiveSite(siteId: string | null | undefined, siteHandlers?: Record<string, string>): string | null {
    if (!siteId) return null;
    return siteHandlers?.[siteId] ?? siteId;
}

export interface MergedTeamSite {
    site: CsiSiteSummary;
    handledSites: CsiSiteSummary[];
}

/**
 * Groups ICT period sites for "Penilaian tim" so any site handled by another site present in the period
 * (e.g. Sukodono -> Sepanjang) is merged into its handler site instead of requiring a separate team card.
 */
export function mergedTeamSites(scope: CsiScopeParam, sites: readonly CsiSiteSummary[]): MergedTeamSite[] {
    if (scope !== 'ict') return sites.map((site) => ({ site, handledSites: [] }));
    const present = new Set(sites.map((site) => site.id));
    const handledByHandler = new Map<string, CsiSiteSummary[]>();
    const roots: CsiSiteSummary[] = [];
    for (const site of sites) {
        const handler = site.handledBySiteId;
        if (handler && present.has(handler)) {
            handledByHandler.set(handler, [...(handledByHandler.get(handler) ?? []), site]);
        } else {
            roots.push(site);
        }
    }
    return roots.map((site) => ({ site, handledSites: handledByHandler.get(site.id) ?? [] }));
}
