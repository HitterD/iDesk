/**
 * Cross-site roles for general modules (non-ticketing).
 * Only ADMIN and MANAGER can see data across all sites.
 * AGENT_ORACLE is ticketing-specific (Oracle/K2 is centralized).
 */
export const CROSS_SITE_ROLES = ['ADMIN', 'MANAGER'] as const;

export type CrossSiteRole = (typeof CROSS_SITE_ROLES)[number];

export const isCrossSiteRole = (role?: string | null): boolean =>
  CROSS_SITE_ROLES.includes(role as CrossSiteRole);
