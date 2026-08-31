import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, HandlingTeam } from '../entities/ticket.entity';
import { isOracleK2Category } from '../utils/oracle-ticket-access.util';

const NON_ORACLE_AGENT_ROLES = [
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
] as const;

export const isNonOracleAgent = (role: UserRole): boolean =>
    (NON_ORACLE_AGENT_ROLES as readonly UserRole[]).includes(role);

export const isOracleTicket = (ticket: Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>): boolean =>
    ticket.handlingTeam === HandlingTeam.ORACLE_DEV ||
    isOracleK2Category(ticket.category, ticket.ticketType);

export const assertTicketRoleAccess = (
    ticket: Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>,
    role: UserRole,
): void => {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.AGENT_ORACLE && !isOracleTicket(ticket)) {
        throw new ForbiddenException('AGENT_ORACLE can only access Oracle/K2 tickets');
    }
    if (isNonOracleAgent(role) && isOracleTicket(ticket)) {
        throw new ForbiddenException('Access to Oracle/K2 tickets is restricted');
    }
};
