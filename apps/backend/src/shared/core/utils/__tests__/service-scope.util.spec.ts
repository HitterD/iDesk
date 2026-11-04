import { UserRole } from '../../../../modules/users/enums/user-role.enum';
import { HandlingTeam } from '../../../../modules/ticketing/entities/ticket.entity';
import { canAccessTicketObject } from '../../../../modules/ticketing/utils/oracle-ticket-access.util';
import {
    ROLE_SCOPE,
    ServiceScope,
    applyServiceScopeFilter,
    canHandleScope,
    scopeOfRole,
    scopeOfTicket,
} from '../service-scope.util';

const STAFF_ROLES = Object.values(UserRole).filter((r) => r !== UserRole.USER && r !== UserRole.ADMIN && r !== UserRole.HC_ADMIN);

describe('service-scope.util', () => {
    it('maps every current ICT staff role (agents + manager) to ICT', () => {
        for (const role of STAFF_ROLES) expect(scopeOfRole(role)).toBe(ServiceScope.ICT);
    });

    it('maps HC_ADMIN to HC, so it never sees ICT tickets', () => {
        expect(scopeOfRole(UserRole.HC_ADMIN)).toBe(ServiceScope.HC);
        expect(canHandleScope(UserRole.HC_ADMIN, ServiceScope.ICT)).toBe(false);
        const q = { andWhere: jest.fn() };
        applyServiceScopeFilter(q, UserRole.HC_ADMIN);
        expect(q.andWhere).toHaveBeenCalledWith('1 = 0');
    });

    it('treats ADMIN as cross-scope and USER as scope-less', () => {
        expect(canHandleScope(UserRole.ADMIN, ServiceScope.HC)).toBe(true);
        expect(scopeOfRole(UserRole.USER)).toBeNull();
    });

    it('fails closed for an unmapped staff role', () => {
        expect(canHandleScope('AGENT_HC_FUTURE', ServiceScope.ICT)).toBe(false);
    });

    it('places every handling team, and legacy tickets without one, in ICT', () => {
        for (const team of Object.values(HandlingTeam)) expect(scopeOfTicket({ handlingTeam: team })).toBe(ServiceScope.ICT);
        expect(scopeOfTicket({ handlingTeam: null })).toBe(ServiceScope.ICT);
    });

    describe('applyServiceScopeFilter', () => {
        const qb = () => ({ andWhere: jest.fn() });

        it('restricts an ICT agent to ICT teams plus legacy NULL rows', () => {
            const q = qb();
            applyServiceScopeFilter(q, UserRole.AGENT);
            const [sql, params] = q.andWhere.mock.calls[0];
            expect(sql).toContain('IS NULL');
            expect(params.scopeTeams.sort()).toEqual(Object.values(HandlingTeam).sort());
        });

        it('adds nothing for ADMIN or USER', () => {
            const q = qb();
            applyServiceScopeFilter(q, UserRole.ADMIN);
            applyServiceScopeFilter(q, UserRole.USER);
            expect(q.andWhere).not.toHaveBeenCalled();
        });

        it('matches nothing for a staff role without a scope', () => {
            const q = qb();
            applyServiceScopeFilter(q, 'AGENT_HC_FUTURE');
            expect(q.andWhere).toHaveBeenCalledWith('1 = 0');
        });
    });

    describe('a future HC agent never handles ICT tickets', () => {
        const original = { ...ROLE_SCOPE };
        afterEach(() => {
            for (const key of Object.keys(ROLE_SCOPE)) delete (ROLE_SCOPE as any)[key];
            Object.assign(ROLE_SCOPE, original);
        });

        it('blocks an HC-mapped role from an ICT ticket, while ICT roles keep access', () => {
            (ROLE_SCOPE as any).AGENT_HC = ServiceScope.HC;
            expect(canAccessTicketObject({ role: 'AGENT_HC' }, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(false);
            expect(canAccessTicketObject({ role: UserRole.AGENT }, { handlingTeam: HandlingTeam.OPS_SUPPORT })).toBe(true);
            expect(canAccessTicketObject({ role: UserRole.MANAGER }, { handlingTeam: HandlingTeam.ORACLE_DEV })).toBe(true);
        });
    });
});
