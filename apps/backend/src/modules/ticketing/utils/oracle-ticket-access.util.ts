import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketType, HandlingTeam } from '../entities/ticket.entity';

export function isMobileDevCategory(category?: string | null, ticketType?: string | null): boolean {
    if (ticketType === TicketType.MOBILE_DEV_REQUEST || ticketType === 'MOBILE_DEV_REQUEST') return true;
    if (!category) return false;
    const cat = category.toLowerCase().trim();
    return (
        cat === 'mobile_dev_request' ||
        cat === 'mobile_developer' ||
        cat === 'mobile developer' ||
        cat.includes('mobile app') ||
        cat.includes('aplikasi mobile') ||
        cat.includes('android') ||
        cat.includes('ios') ||
        cat.includes('flutter')
    );
}

export function isWebDevCategory(category?: string | null, ticketType?: string | null): boolean {
    if (ticketType === TicketType.WEB_DEV_REQUEST || ticketType === 'WEB_DEV_REQUEST') return true;
    if (!category) return false;
    const cat = category.toLowerCase().trim();
    return (
        cat === 'web_dev_request' ||
        cat === 'web_developer' ||
        cat === 'web developer' ||
        cat === 'website' ||
        cat.includes('website') ||
        cat.includes('web portal') ||
        cat.includes('integrasi api') ||
        cat.includes('api / backend') ||
        cat.includes('api backend')
    );
}

export function isOracleDevCategory(category?: string | null, ticketType?: string | null): boolean {
    if (ticketType === TicketType.ORACLE_REQUEST || ticketType === 'ORACLE_REQUEST') return true;
    if (!category) return false;
    const cat = category.toLowerCase().trim();
    return cat === 'oracle' || cat === 'k2' || cat === 'oracle / k2' || cat === 'oracle/k2' || cat === 'oracle_request';
}

export function resolveInitialHandlingTeam(category?: string | null, ticketType?: string | null): HandlingTeam {
    if (isMobileDevCategory(category, ticketType)) return HandlingTeam.MOBILE_DEV;
    if (isWebDevCategory(category, ticketType)) return HandlingTeam.WEB_DEV;
    if (isOracleDevCategory(category, ticketType)) return HandlingTeam.ORACLE_DEV;
    return HandlingTeam.OPS_SUPPORT;
}

export function isOracleK2Category(category?: string | null, ticketType?: string | null): boolean {
    return isMobileDevCategory(category, ticketType) || isWebDevCategory(category, ticketType) || isOracleDevCategory(category, ticketType);
}

export function isOracleRole(role?: string | null): boolean {
    return role === UserRole.AGENT_ORACLE || role === UserRole.AGENT_WEB_DEV;
}

export function canAccessTicketObject(user: { id?: string; role: UserRole | string }, ticket: Partial<Ticket>): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.USER || user.role === UserRole.MANAGER) return true;

    const team = ticket.handlingTeam ?? HandlingTeam.OPS_SUPPORT;

    // Developer agents (Oracle, Web Dev, Mobile Dev) can access all developer queues
    if (
        user.role === UserRole.AGENT_ORACLE ||
        user.role === UserRole.AGENT_WEB_DEV ||
        user.role === UserRole.AGENT_MOBILE_DEV
    ) {
        return (
            team === HandlingTeam.ORACLE_DEV ||
            team === HandlingTeam.WEB_DEV ||
            team === HandlingTeam.MOBILE_DEV
        );
    }

    // Operational support / regular agents can only access OPS_SUPPORT tickets
    const isDevTicket =
        team === HandlingTeam.ORACLE_DEV ||
        team === HandlingTeam.MOBILE_DEV ||
        team === HandlingTeam.WEB_DEV;

    if (isDevTicket) {
        return false;
    }

    return true;
}

export function validateTicketAccess(user: { id?: string; role: UserRole | string }, ticket: Partial<Ticket>): void {
    if (!canAccessTicketObject(user, ticket)) {
        throw new ForbiddenException('Access to this ticket is forbidden');
    }
}
