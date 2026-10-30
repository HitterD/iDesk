import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, HandlingTeam } from '../entities/ticket.entity';
import { canAccessTicketObject, isTicketRequesterSide, validateTicketAccess } from '../utils/oracle-ticket-access.util';
import { canAccessTicketSite, validateTicketSiteAccess } from '../utils/site-access.util';

const NON_ORACLE_AGENT_ROLES = [
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
] as const;

export const isNonOracleAgent = (role: UserRole): boolean =>
    (NON_ORACLE_AGENT_ROLES as readonly UserRole[]).includes(role);

export const isOracleTicket = (ticket: Pick<Ticket, 'handlingTeam'>): boolean =>
    ticket.handlingTeam === HandlingTeam.ORACLE_DEV ||
    ticket.handlingTeam === HandlingTeam.MOBILE_DEV ||
    ticket.handlingTeam === HandlingTeam.WEB_DEV;

export const isDeveloperTicket = (ticket: Pick<Ticket, 'handlingTeam'>): boolean =>
    ticket.handlingTeam === HandlingTeam.ORACLE_DEV ||
    ticket.handlingTeam === HandlingTeam.MOBILE_DEV ||
    ticket.handlingTeam === HandlingTeam.WEB_DEV;

export const assertTicketRoleAccess = (
    ticket: Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>,
    role: UserRole,
): void => {
    if (!canAccessTicketObject({ role }, ticket)) {
        throw new ForbiddenException('Access to this ticket is forbidden');
    }
};

/**
 * `handler`: staff of the ticket's team and site — full view incl. internal notes.
 * `requester`: requester, filer or participant (and any USER) — public chat only,
 * kept even after the ticket is forwarded to another team or site.
 */
export type TicketViewerAccess = 'handler' | 'requester';

type AccessTicket = Pick<Partial<Ticket>, 'category' | 'ticketType' | 'handlingTeam' | 'siteId' | 'userId' | 'createdById' | 'participants'>;

/** Throws when the viewer may not open the ticket at all. */
export const resolveTicketViewerAccess = (
    ticket: AccessTicket,
    viewer: { id?: string | null; role: UserRole | string; siteId?: string | null },
): TicketViewerAccess => {
    const role = viewer.role as UserRole;
    const siteId = viewer.siteId ?? null;
    if (role !== UserRole.USER && canAccessTicketObject({ role }, ticket) && canAccessTicketSite(role, siteId, ticket.siteId)) {
        return 'handler';
    }
    if (isTicketRequesterSide(viewer.id, ticket)) return 'requester';
    validateTicketAccess({ role }, ticket);
    validateTicketSiteAccess(role, siteId, ticket.siteId);
    // Only a USER gets here: staff passing both checks returned `handler` above.
    return 'requester';
};
