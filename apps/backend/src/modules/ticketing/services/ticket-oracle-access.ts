import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
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
 * `requester`: requester, filer or participant — public chat only,
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
    // Neither handler nor on the ticket: no access. A USER has no handler path, so a same-site
    // USER who is not the requester, filer or a participant lands here too.
    if (role !== UserRole.USER) {
        validateTicketAccess({ role }, ticket);
        validateTicketSiteAccess(role, siteId, ticket.siteId);
    }
    throw new ForbiddenException('Access to this ticket is forbidden');
};

/** True when the user is the manager or GM the request flow of this ticket names (see `request_flows`). */
export const isRequestFlowApprover = async (
    manager: Pick<EntityManager, 'query'>,
    ticketId: string,
    userId: string | null | undefined,
): Promise<boolean> => {
    if (!userId) return false;
    const rows: unknown[] = await manager.query(
        'SELECT 1 AS one FROM request_flows WHERE "ticketId" = $1 AND ("managerId" = $2 OR "gmId" = $2) LIMIT 1',
        [ticketId, userId],
    );
    return rows.length > 0;
};

/**
 * Like `resolveTicketViewerAccess`, but the approver of a request ticket (manager or GM of its flow) who is otherwise
 * refused (another site, a plain USER, another team) may still open it and chat as a requester-side viewer: public
 * messages only, no handler rights. The flow is only looked up when the regular rule refuses.
 */
export const resolveTicketViewerAccessWithFlow = async (
    ticket: AccessTicket & { id?: string },
    viewer: { id?: string | null; role: UserRole | string; siteId?: string | null },
    manager: Pick<EntityManager, 'query'>,
): Promise<TicketViewerAccess> => {
    try {
        return resolveTicketViewerAccess(ticket, viewer);
    } catch (err) {
        if (err instanceof ForbiddenException && ticket.id && await isRequestFlowApprover(manager, ticket.id, viewer.id)) return 'requester';
        throw err;
    }
};
