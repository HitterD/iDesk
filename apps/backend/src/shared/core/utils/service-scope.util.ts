import { UserRole } from '../../../modules/users/enums/user-role.enum';
import { HandlingTeam } from '../../../modules/ticketing/entities/ticket.entity';

/**
 * Department that services a ticket — the "handler" side. Not the same as
 * `Department` on a user, which is the requester's work unit synced from HRIS.
 * Every queue today is ICT; HC (Human Capital) gets its own roles, teams and
 * modules later and must never see ICT tickets (and vice versa).
 */
export enum ServiceScope {
    ICT = 'ICT',
    HC = 'HC',
}

/**
 * Single source of truth for which scope a staff role works in. ADMIN is
 * absent on purpose (cross-scope); USER is a requester and has no scope.
 * Mirrored in frontend `lib/constants/service-scope.ts`.
 */
export const ROLE_SCOPE: Readonly<Partial<Record<UserRole, ServiceScope>>> = {
    [UserRole.AGENT]: ServiceScope.ICT,
    [UserRole.AGENT_OPERATIONAL_SUPPORT]: ServiceScope.ICT,
    [UserRole.AGENT_ADMIN]: ServiceScope.ICT,
    [UserRole.AGENT_ORACLE]: ServiceScope.ICT,
    [UserRole.AGENT_WEB_DEV]: ServiceScope.ICT,
    [UserRole.AGENT_MOBILE_DEV]: ServiceScope.ICT,
    [UserRole.MANAGER]: ServiceScope.ICT,
    [UserRole.HC_ADMIN]: ServiceScope.HC,
};

/** Which scope owns each handling team. */
export const HANDLING_TEAM_SCOPE: Readonly<Record<HandlingTeam, ServiceScope>> = {
    [HandlingTeam.OPS_SUPPORT]: ServiceScope.ICT,
    [HandlingTeam.ORACLE_DEV]: ServiceScope.ICT,
    [HandlingTeam.WEB_DEV]: ServiceScope.ICT,
    [HandlingTeam.MOBILE_DEV]: ServiceScope.ICT,
};

/** Legacy tickets have no handling team; they were always ops support. */
const DEFAULT_TICKET_SCOPE = ServiceScope.ICT;

export function isCrossScopeRole(role: UserRole | string | null | undefined): boolean {
    return role === UserRole.ADMIN;
}

export function scopeOfRole(role: UserRole | string | null | undefined): ServiceScope | null {
    return ROLE_SCOPE[role as UserRole] ?? null;
}

export function scopeOfTicket(ticket: { handlingTeam?: HandlingTeam | string | null }): ServiceScope {
    return HANDLING_TEAM_SCOPE[ticket.handlingTeam as HandlingTeam] ?? DEFAULT_TICKET_SCOPE;
}

/**
 * Whether a staff role may handle work of this scope. Fails closed: a staff
 * role missing from ROLE_SCOPE handles nothing until it is mapped.
 */
export function canHandleScope(role: UserRole | string | null | undefined, scope: ServiceScope): boolean {
    if (isCrossScopeRole(role)) return true;
    return scopeOfRole(role) === scope;
}

/** Handling teams a role may see; null means no restriction (cross-scope). */
export function handlingTeamsForRole(role: UserRole | string | null | undefined): HandlingTeam[] | null {
    if (isCrossScopeRole(role)) return null;
    const scope = scopeOfRole(role);
    return (Object.keys(HANDLING_TEAM_SCOPE) as HandlingTeam[]).filter((team) => HANDLING_TEAM_SCOPE[team] === scope);
}

/**
 * SQL guard limiting a ticket query to the role's scope. Legacy rows with a
 * NULL handling team count as the default scope. Requesters (USER) are left
 * alone: their lists are already limited to tickets they own or joined.
 */
export function applyServiceScopeFilter(
    qb: { andWhere(condition: string, params?: Record<string, unknown>): unknown },
    role: UserRole | string,
    alias = 'ticket',
): void {
    if (role === UserRole.USER) return;
    const teams = handlingTeamsForRole(role);
    if (teams === null) return;
    if (teams.length === 0) {
        qb.andWhere('1 = 0');
        return;
    }
    const includesLegacy = scopeOfRole(role) === DEFAULT_TICKET_SCOPE;
    qb.andWhere(
        `(${alias}."handlingTeam" IN (:...scopeTeams)${includesLegacy ? ` OR ${alias}."handlingTeam" IS NULL` : ''})`,
        { scopeTeams: teams },
    );
}
