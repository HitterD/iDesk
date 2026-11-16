import { ServiceScope } from '../../../shared/core/utils/service-scope.util';

export interface PeriodSiteRef {
    siteId: string;
    site?: {
        id?: string;
        code?: string | null;
        name?: string | null;
        handledBySiteId?: string | null;
    } | null;
}

export interface MergedSiteGroup {
    id: string;
    code: string | null;
    name: string | null;
    sourceSiteIds: string[];
    handledCodes: string[];
}

export function formatMergedSiteName(name: string | null | undefined, code: string | null | undefined, handledCodes: readonly string[]): string | null {
    const base = name ?? code ?? null;
    if (!handledCodes.length) return base;
    const suffix = handledCodes.filter(Boolean).join(', ');
    if (!suffix) return base;
    return base ? `${base} (+ ${suffix})` : `+ ${suffix}`;
}

/**
 * Merges delegated ICT sites (e.g. SKD -> SPJ via `handledBySiteId`) into their handler site
 * whenever both are part of the survey. HC always keeps every site separate.
 */
export function mergeHandledSites(
    scope: ServiceScope,
    sites: readonly PeriodSiteRef[],
    siteHandlers?: ReadonlyMap<string, string>,
): MergedSiteGroup[] {
    if (scope !== ServiceScope.ICT) {
        return sites.map((row) => ({
            id: row.siteId,
            code: row.site?.code ?? null,
            name: row.site?.name ?? null,
            sourceSiteIds: [row.siteId],
            handledCodes: [],
        }));
    }

    const present = new Set(sites.map((row) => row.siteId));
    const childrenByHandler = new Map<string, PeriodSiteRef[]>();
    const roots: PeriodSiteRef[] = [];

    for (const row of sites) {
        const handlerId = row.site?.handledBySiteId ?? siteHandlers?.get(row.siteId) ?? null;
        if (handlerId && handlerId !== row.siteId && present.has(handlerId)) {
            childrenByHandler.set(handlerId, [...(childrenByHandler.get(handlerId) ?? []), row]);
        } else {
            roots.push(row);
        }
    }

    return roots.map((row) => {
        const children = childrenByHandler.get(row.siteId) ?? [];
        const handledCodes = children
            .map((child) => child.site?.code ?? child.site?.name ?? '')
            .filter(Boolean);
        return {
            id: row.siteId,
            code: row.site?.code ?? null,
            name: formatMergedSiteName(row.site?.name, row.site?.code, handledCodes),
            sourceSiteIds: [row.siteId, ...children.map((child) => child.siteId)],
            handledCodes,
        };
    });
}

/** Map of delegated child siteId -> code (used to preserve row badges in Dashboard pending/comments lists). */
export function delegatedSiteCodeMap(
    scope: ServiceScope,
    sites: readonly PeriodSiteRef[],
    siteHandlers?: ReadonlyMap<string, string>,
): Record<string, string> {
    if (scope !== ServiceScope.ICT) return {};
    const present = new Set(sites.map((row) => row.siteId));
    const map: Record<string, string> = {};
    for (const row of sites) {
        const handlerId = row.site?.handledBySiteId ?? siteHandlers?.get(row.siteId) ?? null;
        if (handlerId && handlerId !== row.siteId && present.has(handlerId)) {
            const label = row.site?.code ?? row.site?.name;
            if (label) map[row.siteId] = label;
        }
    }
    return map;
}
