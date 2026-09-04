import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, HandlingTeam } from '../entities/ticket.entity';
import { canAccessTicketObject } from '../utils/oracle-ticket-access.util';

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
