import { ForbiddenException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket } from '../entities/ticket.entity';
import { TICKET_CROSS_SITE_ROLES } from '../../../shared/core/utils/site-scope.util';

/**
 * Roles allowed to see tickets from every site.
 *
 * Source of truth for the list is in shared/core/utils/site-scope.util.ts (TICKET_CROSS_SITE_ROLES).
 * This module re-exports a ticket-specific isCrossSiteRole for backward compatibility.
 */
const CROSS_SITE_ROLES: readonly UserRole[] = TICKET_CROSS_SITE_ROLES;

export function isCrossSiteRole(role: UserRole | string | null | undefined): boolean {
    return CROSS_SITE_ROLES.includes(role as UserRole);
}

/**
 * Restricts a ticket query to the caller's site.
 *
 * Site-locked roles without a site assignment match nothing (fail-closed): an
 * unscoped account must never fall through to seeing every site's tickets.
 */
export function applySiteFilter(
    qb: SelectQueryBuilder<Ticket>,
    role: UserRole,
    userSiteId: string | null,
    options: { siteId?: string; siteIds?: string[] } = {},
): void {
    if (isCrossSiteRole(role)) {
        const { siteId, siteIds } = options;
        if (siteIds && siteIds.length > 0) {
            qb.andWhere('ticket.siteId IN (:...siteIds)', { siteIds });
        } else if (siteId) {
            qb.andWhere('ticket.siteId = :siteId', { siteId });
        }
        return;
    }

    if (!userSiteId) {
        qb.andWhere('1 = 0');
        return;
    }

    qb.andWhere('ticket.siteId = :userSiteId', { userSiteId });
}

export function canAccessTicketSite(
    role: UserRole,
    userSiteId: string | null,
    ticketSiteId: string | null | undefined,
): boolean {
    if (isCrossSiteRole(role)) return true;
    if (!userSiteId) return false;
    return ticketSiteId === userSiteId;
}

export function validateTicketSiteAccess(
    role: UserRole,
    userSiteId: string | null,
    ticketSiteId: string | null | undefined,
): void {
    if (!canAccessTicketSite(role, userSiteId, ticketSiteId)) {
        throw new ForbiddenException('Access to tickets from other sites is forbidden');
    }
}

/** Cache-key fragment so one site's dashboard never serves another's numbers. */
export function siteScopeKey(role: UserRole, userSiteId: string | null): string {
    if (isCrossSiteRole(role)) return 'all';
    return userSiteId ?? 'none';
}
