import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketType, HandlingTeam } from '../entities/ticket.entity';

export function isOracleK2Category(category?: string | null, ticketType?: string | null): boolean {
    if (ticketType === TicketType.ORACLE_REQUEST || ticketType === 'ORACLE_REQUEST') return true;
    if (!category) return false;
    const cat = category.toLowerCase().trim();
    return cat === 'oracle' || cat === 'k2' || cat === 'oracle / k2' || cat === 'oracle/k2' || cat === 'oracle_request';
}

export function isOracleRole(role?: string | null): boolean {
    return role === UserRole.AGENT_ORACLE;
}

export function canAccessTicketObject(user: { id?: string; role: UserRole | string }, ticket: Partial<Ticket>): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.USER) return true;

    const isOracleTicket = ticket.handlingTeam === HandlingTeam.ORACLE_DEV;
    const isOracle = isOracleRole(user.role);

    if (isOracle) {
        return isOracleTicket;
    }

    if (isOracleTicket) {
        return false;
    }

    return true;
}

export function validateTicketAccess(user: { id?: string; role: UserRole | string }, ticket: Partial<Ticket>): void {
    if (!canAccessTicketObject(user, ticket)) {
        throw new ForbiddenException('Access to this ticket is forbidden');
    }
}
