import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../modules/users/enums/user-role.enum';

/**
 * Roles allowed to see data from every site (general modules).
 * ADMIN owns the platform, MANAGER needs cross-site reporting.
 * AGENT_ORACLE is only cross-site for ticketing (Oracle/K2 is centralized).
 */
export const CROSS_SITE_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
];

/**
 * Roles allowed to see tickets from every site.
 * Includes AGENT_ORACLE because Oracle/K2 is a central system spanning all sites.
 */
export const TICKET_CROSS_SITE_ROLES: readonly UserRole[] = [
  ...CROSS_SITE_ROLES,
  UserRole.AGENT_ORACLE,
  UserRole.AGENT_WEB_DEV,
  UserRole.AGENT_MOBILE_DEV,
];

export type SiteActor = {
  role: UserRole;
  siteId: string | null;
};

export type SiteScope =
  | { mode: 'all' }                      // cross-site roles — no site filter
  | { mode: 'site'; siteId: string }     // site-locked with a site
  | { mode: 'none' };                    // site-locked without site → match nothing (fail-closed)

/**
 * Returns true only for ADMIN and MANAGER (general cross-site).
 * Use TICKET_CROSS_SITE_ROLES / isCrossSiteRole from ticketing util for tickets.
 */
export function isCrossSiteRole(role: UserRole | string | null | undefined): boolean {
  return CROSS_SITE_ROLES.includes(role as UserRole);
}

/**
 * Resolves the effective scope for a given actor.
 * - Cross-site roles → 'all'
 * - Has siteId → 'site'
 * - No siteId → 'none' (must never leak to all sites)
 */
export function resolveSiteScope(actor: SiteActor): SiteScope {
  if (isCrossSiteRole(actor.role)) {
    return { mode: 'all' };
  }
  if (!actor.siteId) {
    return { mode: 'none' };
  }
  return { mode: 'site', siteId: actor.siteId };
}

/**
 * Throws ForbiddenException if the actor cannot access the given resource site.
 * Call this on every single-resource read and every mutation.
 */
export function assertSiteAccess(
  actor: SiteActor,
  resourceSiteId: string | null | undefined,
): void {
  const scope = resolveSiteScope(actor);

  if (scope.mode === 'all') {
    return;
  }

  if (scope.mode === 'none') {
    throw new ForbiddenException('Access to this resource is forbidden');
  }

  if (resourceSiteId !== scope.siteId) {
    throw new ForbiddenException('Access to resources from other sites is forbidden');
  }
}

/**
 * Returns a stable fragment suitable for cache keys.
 * Examples: 'all', 'spj', 'none'
 */
export function scopeKey(actor: SiteActor): string {
  if (isCrossSiteRole(actor.role)) return 'all';
  return actor.siteId ?? 'none';
}
