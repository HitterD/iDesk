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
export interface MergedSiteGroup {
    id: string;
    code: string | null;
    name: string | null;
    /** Display label used on site cards and summaries (e.g. "Sepanjang (+ SKD)"). */
    displayName: string;
    /** Compact tab label used in segmented site filters (e.g. "SPJ"). */
    tabLabel: string;
    sourceSiteIds: ReadonlySet<string>;
}

export function mergedSiteDisplayName(
    name: string | null | undefined,
    code: string | null | undefined,
    handledSites: readonly CsiSiteSummary[],
): string {
    const base = name ?? code ?? '';
    const suffix = handledSites.map((s) => s.code ?? s.name ?? '').filter(Boolean).join(', ');
    if (!suffix) return base;
    return base ? `${base} (+ ${suffix})` : `+ ${suffix}`;
}

export function mergedSiteGroups(scope: CsiScopeParam, sites: readonly CsiSiteSummary[]): MergedSiteGroup[] {
    return mergedTeamSites(scope, sites).map(({ site, handledSites }) => ({
        id: site.id,
        code: site.code,
        name: site.name,
        displayName: mergedSiteDisplayName(site.name, site.code, handledSites),
        tabLabel: site.code ?? site.name ?? site.id,
        sourceSiteIds: new Set([site.id, ...handledSites.map((child) => child.id)]),
    }));
}

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
