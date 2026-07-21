import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket } from '../entities/ticket.entity';
import { isOracleK2Category, validateTicketAccess } from '../utils/oracle-ticket-access.util';

const NON_ORACLE_AGENT_ROLES = [
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
] as const;

export const isNonOracleAgent = (role: UserRole): boolean =>
    (NON_ORACLE_AGENT_ROLES as readonly UserRole[]).includes(role);

export const isOracleTicket = (ticket: Pick<Ticket, 'category' | 'ticketType'>): boolean =>
    isOracleK2Category(ticket.category, ticket.ticketType);

export const assertTicketRoleAccess = (
    ticket: Pick<Ticket, 'category' | 'ticketType'>,
    role: UserRole,
): void => {
    validateTicketAccess({ role }, ticket);
};
