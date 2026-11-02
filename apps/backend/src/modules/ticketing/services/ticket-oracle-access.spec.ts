import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { Ticket, TicketType, HandlingTeam } from '../entities/ticket.entity';
import { assertTicketRoleAccess, resolveTicketViewerAccess } from './ticket-oracle-access';

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

describe('resolveTicketViewerAccess', () => {
    const devTicket = { handlingTeam: HandlingTeam.ORACLE_DEV, siteId: 'site-smg', userId: 'agent-smg', createdById: null, participants: [] };
    const filedTicket = { ...devTicket, userId: 'user-1', createdById: 'agent-smg' };
    const opsOtherSite = { handlingTeam: HandlingTeam.OPS_SUPPORT, siteId: 'site-krw', userId: 'agent-smg', createdById: null, participants: [] };

    it('handling team gets handler access', () => {
        expect(resolveTicketViewerAccess(devTicket, { id: 'dev-1', role: UserRole.AGENT_ORACLE, siteId: 'site-spj' })).toBe('handler');
        expect(resolveTicketViewerAccess(opsOtherSite, { id: 'ops-krw', role: UserRole.AGENT, siteId: 'site-krw' })).toBe('handler');
    });

    it('a support agent keeps requester access to a ticket they requested or filed after it moved team/site', () => {
        expect(resolveTicketViewerAccess(devTicket, { id: 'agent-smg', role: UserRole.AGENT, siteId: 'site-smg' })).toBe('requester');
        expect(resolveTicketViewerAccess(filedTicket, { id: 'agent-smg', role: UserRole.AGENT, siteId: 'site-smg' })).toBe('requester');
        expect(resolveTicketViewerAccess(opsOtherSite, { id: 'agent-smg', role: UserRole.AGENT, siteId: 'site-smg' })).toBe('requester');
    });

    it('other staff outside the team or site are still denied', () => {
        expect(() => resolveTicketViewerAccess(devTicket, { id: 'other', role: UserRole.AGENT, siteId: 'site-smg' }))
            .toThrow(ForbiddenException);
        expect(() => resolveTicketViewerAccess(opsOtherSite, { id: 'other', role: UserRole.AGENT, siteId: 'site-smg' }))
            .toThrow(ForbiddenException);
    });

    it('USER is always the requester side', () => {
        expect(resolveTicketViewerAccess(filedTicket, { id: 'user-1', role: UserRole.USER, siteId: 'site-smg' })).toBe('requester');
    });

    it("a USER cannot open another requester's ticket, even on the same site", () => {
        expect(() => resolveTicketViewerAccess(filedTicket, { id: 'user-2', role: UserRole.USER, siteId: 'site-smg' }))
            .toThrow(ForbiddenException);
    });

    it('a USER invited as participant keeps requester access from any site', () => {
        const withGuest = { ...filedTicket, participants: [{ userId: 'guest' }] };
        expect(resolveTicketViewerAccess(withGuest as never, { id: 'guest', role: UserRole.USER, siteId: 'site-krw' })).toBe('requester');
    });
});
