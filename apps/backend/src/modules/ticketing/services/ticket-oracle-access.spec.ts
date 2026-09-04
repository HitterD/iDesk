import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketType, HandlingTeam } from '../entities/ticket.entity';
import { assertTicketRoleAccess } from './ticket-oracle-access';

const oracleTicket = { category: 'ORACLE_REQUEST', handlingTeam: HandlingTeam.ORACLE_DEV, ticketType: TicketType.SERVICE } as Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>;
const webDevTicket = { category: 'WEB_DEV_REQUEST', handlingTeam: HandlingTeam.WEB_DEV, ticketType: TicketType.WEB_DEV_REQUEST } as Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>;
const mobileDevTicket = { category: 'MOBILE_DEV_REQUEST', handlingTeam: HandlingTeam.MOBILE_DEV, ticketType: TicketType.MOBILE_DEV_REQUEST } as Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>;
const standardTicket = { category: 'GENERAL', ticketType: TicketType.SERVICE } as Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>;

describe('assertTicketRoleAccess', () => {
    it.each([
        [UserRole.ADMIN, oracleTicket, false],
        [UserRole.ADMIN, webDevTicket, false],
        [UserRole.ADMIN, mobileDevTicket, false],
        [UserRole.ADMIN, standardTicket, false],

        [UserRole.AGENT_ORACLE, oracleTicket, false],
        [UserRole.AGENT_ORACLE, webDevTicket, false],
        [UserRole.AGENT_ORACLE, mobileDevTicket, false],
        [UserRole.AGENT_ORACLE, standardTicket, true],

        [UserRole.AGENT_WEB_DEV, webDevTicket, false],
        [UserRole.AGENT_WEB_DEV, oracleTicket, false],
        [UserRole.AGENT_WEB_DEV, mobileDevTicket, false],
        [UserRole.AGENT_WEB_DEV, standardTicket, true],

        [UserRole.AGENT_MOBILE_DEV, mobileDevTicket, false],
        [UserRole.AGENT_MOBILE_DEV, oracleTicket, false],
        [UserRole.AGENT_MOBILE_DEV, webDevTicket, false],
        [UserRole.AGENT_MOBILE_DEV, standardTicket, true],

        [UserRole.AGENT, oracleTicket, true],
        [UserRole.AGENT, webDevTicket, true],
        [UserRole.AGENT, mobileDevTicket, true],
        [UserRole.AGENT_OPERATIONAL_SUPPORT, oracleTicket, true],
        [UserRole.AGENT_ADMIN, oracleTicket, true],
        [UserRole.USER, oracleTicket, false],
        [UserRole.USER, mobileDevTicket, false],
        [UserRole.USER, webDevTicket, false],
    ])('%s gets expected queue access for ticket', (role, ticket, denied) => {
        if (denied) {
            expect(() => assertTicketRoleAccess(ticket, role)).toThrow(ForbiddenException);
            return;
        }
        expect(() => assertTicketRoleAccess(ticket, role)).not.toThrow();
    });
});
