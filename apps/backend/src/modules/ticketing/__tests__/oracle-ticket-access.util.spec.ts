import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { canAccessTicketObject, isOracleK2Category, validateTicketAccess } from '../utils/oracle-ticket-access.util';

describe('Oracle Ticket Access Utility', () => {
    it('correctly identifies Oracle/K2 categories', () => {
        expect(isOracleK2Category('Oracle')).toBe(true);
        expect(isOracleK2Category('K2')).toBe(true);
        expect(isOracleK2Category('Oracle / K2')).toBe(true);
        expect(isOracleK2Category('oracle/k2')).toBe(true);
        expect(isOracleK2Category('Hardware')).toBe(false);
        expect(isOracleK2Category(null)).toBe(false);
    });

    it('allows ADMIN access to all tickets', () => {
        const user = { role: UserRole.ADMIN };
        expect(canAccessTicketObject(user, { category: 'Oracle' })).toBe(true);
        expect(canAccessTicketObject(user, { category: 'Hardware' })).toBe(true);
    });

    it('restricts AGENT_ORACLE to Oracle tickets only', () => {
        const user = { role: UserRole.AGENT_ORACLE };
        expect(canAccessTicketObject(user, { category: 'Oracle' })).toBe(true);
        expect(canAccessTicketObject(user, { category: 'Hardware' })).toBe(false);
    });

    it('prevents non-Oracle agents and users from accessing Oracle tickets', () => {
        const agent = { role: UserRole.AGENT };
        const user = { role: UserRole.USER };
        expect(canAccessTicketObject(agent, { category: 'Oracle' })).toBe(false);
        expect(canAccessTicketObject(user, { category: 'Oracle' })).toBe(false);
        expect(canAccessTicketObject(agent, { category: 'Hardware' })).toBe(true);
    });

    it('throws ForbiddenException when validateTicketAccess fails', () => {
        const agent = { role: UserRole.AGENT };
        expect(() => validateTicketAccess(agent, { category: 'Oracle' })).toThrow(ForbiddenException);
    });
});
