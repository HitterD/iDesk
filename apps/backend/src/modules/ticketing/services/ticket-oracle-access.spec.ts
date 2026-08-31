import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketType, HandlingTeam } from '../entities/ticket.entity';
import { assertTicketRoleAccess } from './ticket-oracle-access';

const oracleTicket = { category: 'ORACLE_REQUEST', handlingTeam: HandlingTeam.ORACLE_DEV, ticketType: TicketType.SERVICE } as Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>;
const standardTicket = { category: 'GENERAL', ticketType: TicketType.SERVICE } as Pick<Ticket, 'category' | 'ticketType' | 'handlingTeam'>;

describe('assertTicketRoleAccess', () => {
    it.each([
        [UserRole.ADMIN, oracleTicket, false],
        [UserRole.ADMIN, standardTicket, false],
        [UserRole.AGENT_ORACLE, oracleTicket, false],
        [UserRole.AGENT_ORACLE, standardTicket, true],
        [UserRole.AGENT, oracleTicket, true],
        [UserRole.AGENT_OPERATIONAL_SUPPORT, oracleTicket, true],
        [UserRole.AGENT_ADMIN, oracleTicket, true],
        [UserRole.USER, oracleTicket, false],
    ])('%s gets expected queue access', (role, ticket, denied) => {
        if (denied) {
            expect(() => assertTicketRoleAccess(ticket, role)).toThrow(ForbiddenException);
            return;
        }
        expect(() => assertTicketRoleAccess(ticket, role)).not.toThrow();
    });
});
