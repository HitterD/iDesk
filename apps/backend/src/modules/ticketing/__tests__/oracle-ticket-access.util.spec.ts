import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { HandlingTeam } from '../../ticketing/entities/ticket.entity';
import { canAccessTicketObject, isOracleK2Category, validateTicketAccess } from '../utils/oracle-ticket-access.util';

describe('Oracle Ticket Access Utility', () => {
    it('correctly identifies Oracle/K2 categories (used to set initial handlingTeam on create)', () => {
        expect(isOracleK2Category('Oracle')).toBe(true);
        expect(isOracleK2Category('K2')).toBe(true);
        expect(isOracleK2Category('Oracle / K2')).toBe(true);
        expect(isOracleK2Category('oracle/k2')).toBe(true);
        expect(isOracleK2Category('Hardware')).toBe(false);
        expect(isOracleK2Category(null)).toBe(false);
    });

    it('allows ADMIN access to all tickets', () => {
        const user = { role: UserRole.ADMIN };
        expect(canAccessTicketObject(user, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        expect(canAccessTicketObject(user, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(true);
    });

    it('restricts AGENT_ORACLE to ORACLE_DEV tickets only', () => {
        const user = { role: UserRole.AGENT_ORACLE };
        expect(canAccessTicketObject(user, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        expect(canAccessTicketObject(user, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(false);
    });

    it('prevents non-Oracle agents from accessing ORACLE_DEV tickets while allowing USER requests', () => {
        const agent = { role: UserRole.AGENT };
        const user = { role: UserRole.USER };
        expect(canAccessTicketObject(agent, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(false);
        expect(canAccessTicketObject(user, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        expect(canAccessTicketObject(agent, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(true);
    });

    it('a forwarded ticket (OPS_SUPPORT) is no longer Oracle even with an Oracle category', () => {
        const agent = { role: UserRole.AGENT };
        // After forwarding to OPS_SUPPORT, category may still read ORACLE_REQUEST,
        // but handlingTeam is the single source of truth.
        expect(canAccessTicketObject(agent, { handlingTeam: HandlingTeam.OPS_SUPPORT, category: 'ORACLE_REQUEST' })).toBe(true);
    });

    it('correctly identifies Mobile Dev categories and Web Dev categories', () => {
        expect(canAccessTicketObject({ role: UserRole.AGENT_MOBILE_DEV }, { handlingTeam: HandlingTeam.MOBILE_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_MOBILE_DEV }, { handlingTeam: HandlingTeam.WEB_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_MOBILE_DEV }, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_MOBILE_DEV }, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(false);
        expect(canAccessTicketObject({ role: UserRole.AGENT_WEB_DEV }, { handlingTeam: HandlingTeam.WEB_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_WEB_DEV }, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_WEB_DEV }, { handlingTeam: HandlingTeam.MOBILE_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_WEB_DEV }, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(false);
        expect(canAccessTicketObject({ role: UserRole.AGENT_ORACLE }, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        expect(canAccessTicketObject({ role: UserRole.AGENT_ORACLE }, { handlingTeam: HandlingTeam.WEB_DEV })).toBe(true);
    });

    it('throws ForbiddenException when validateTicketAccess fails', () => {
        const agent = { role: UserRole.AGENT };
        expect(() => validateTicketAccess(agent, { handlingTeam: HandlingTeam.ORACLE_DEV })).toThrow(ForbiddenException);
        expect(() => validateTicketAccess(agent, { handlingTeam: HandlingTeam.MOBILE_DEV })).toThrow(ForbiddenException);
        expect(() => validateTicketAccess(agent, { handlingTeam: HandlingTeam.WEB_DEV })).toThrow(ForbiddenException);
    });
});
