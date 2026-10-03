import { ForbiddenException } from '@nestjs/common';
import { Equal, FindOperator, In, IsNull, ObjectLiteral, Or, SelectQueryBuilder } from 'typeorm';
import { HandlingTeam } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { TICKET_CROSS_SITE_ROLES, isCrossSiteRole } from '../../../shared/core/utils/site-scope.util';

/**
 * Report "team" filter. One per handling team, plus ALL_DEV for the three
 * developer teams together. No team (undefined) means every team, which only
 * ADMIN/MANAGER may request.
 */
export const ALL_DEV_TEAM = 'ALL_DEV';
export const REPORT_TEAMS = [
    HandlingTeam.OPS_SUPPORT,
    HandlingTeam.ORACLE_DEV,
    HandlingTeam.WEB_DEV,
    HandlingTeam.MOBILE_DEV,
    ALL_DEV_TEAM,
] as const;
export type ReportTeam = (typeof REPORT_TEAMS)[number];

export const DEV_HANDLING_TEAMS: readonly HandlingTeam[] = [
    HandlingTeam.ORACLE_DEV,
    HandlingTeam.WEB_DEV,
    HandlingTeam.MOBILE_DEV,
];

export const REPORT_TEAM_LABELS: Record<ReportTeam, string> = {
    [HandlingTeam.OPS_SUPPORT]: 'IT Support',
    [HandlingTeam.ORACLE_DEV]: 'Oracle / K2',
    [HandlingTeam.WEB_DEV]: 'Web Dev',
    [HandlingTeam.MOBILE_DEV]: 'Mobile Dev',
    [ALL_DEV_TEAM]: 'Semua Tim Dev',
};
export const ALL_TEAMS_LABEL = 'Semua Tim';

const SUPPORT_ROLES: readonly UserRole[] = [
    UserRole.AGENT,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
];

const TEAM_ROLES: Record<ReportTeam, readonly UserRole[]> = {
    [HandlingTeam.OPS_SUPPORT]: SUPPORT_ROLES,
    [HandlingTeam.ORACLE_DEV]: [UserRole.AGENT_ORACLE],
    [HandlingTeam.WEB_DEV]: [UserRole.AGENT_WEB_DEV],
    [HandlingTeam.MOBILE_DEV]: [UserRole.AGENT_MOBILE_DEV],
    [ALL_DEV_TEAM]: [UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV],
};

/** Every agent role across all teams. */
export const ALL_TEAM_AGENT_ROLES: readonly UserRole[] = [
    ...SUPPORT_ROLES,
    ...TEAM_ROLES[ALL_DEV_TEAM],
];

export function isReportTeam(value: unknown): value is ReportTeam {
    return typeof value === 'string' && (REPORT_TEAMS as readonly string[]).includes(value);
}

export function teamLabel(team?: ReportTeam | null): string {
    return team ? REPORT_TEAM_LABELS[team] : ALL_TEAMS_LABEL;
}

/** Agent roles that belong to a team; every agent role when no team is given. */
export function rolesForTeam(team?: ReportTeam | null): readonly UserRole[] {
    return team ? TEAM_ROLES[team] : ALL_TEAM_AGENT_ROLES;
}

/**
 * The team an agent role is locked to. Undefined for ADMIN/MANAGER (free to
 * pick any team); null for roles that may not see any team report.
 */
export function teamForRole(role: UserRole | string | null | undefined): ReportTeam | null | undefined {
    if (isCrossSiteRole(role)) return undefined;
    if (SUPPORT_ROLES.includes(role as UserRole)) return HandlingTeam.OPS_SUPPORT;
    if (role === UserRole.AGENT_ORACLE) return HandlingTeam.ORACLE_DEV;
    if (role === UserRole.AGENT_WEB_DEV) return HandlingTeam.WEB_DEV;
    if (role === UserRole.AGENT_MOBILE_DEV) return HandlingTeam.MOBILE_DEV;
    return null;
}

export interface ReportActor {
    role: UserRole | string;
    siteId: string | null;
}

export interface ReportScope {
    team?: ReportTeam;
    siteId?: string;
}

/**
 * Resolve the team and site a report request may cover.
 * - ADMIN/MANAGER: any team (or all) and any site (or all).
 * - Agents: locked to their own team; asking for another team is forbidden.
 * - Support agents are locked to their own site; dev agents handle tickets
 *   from every site (TICKET_CROSS_SITE_ROLES) so they may pick a site.
 */
export function resolveReportScope(
    actor: ReportActor,
    requestedTeam?: string,
    requestedSiteId?: string,
): ReportScope {
    if (requestedTeam && !isReportTeam(requestedTeam)) {
        throw new ForbiddenException(`Unknown report team: ${requestedTeam}`);
    }

    const ownTeam = teamForRole(actor.role);
    if (ownTeam === null) {
        throw new ForbiddenException('This role has no team report');
    }
    if (ownTeam && requestedTeam && requestedTeam !== ownTeam) {
        throw new ForbiddenException('You can only view your own team report');
    }
    const team = ownTeam ?? (requestedTeam as ReportTeam | undefined);

    if (TICKET_CROSS_SITE_ROLES.includes(actor.role as UserRole)) {
        return { team, siteId: requestedSiteId || undefined };
    }
    if (!actor.siteId) {
        throw new ForbiddenException('Cannot view reports without a site context');
    }
    if (requestedSiteId && requestedSiteId !== actor.siteId) {
        throw new ForbiddenException('Access to reports from other sites is forbidden');
    }
    return { team, siteId: actor.siteId };
}

/**
 * Narrow a ticket query to a team. Tickets without a handling team predate
 * the team split and count as IT Support.
 */
export function applyTeamFilter<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, team?: ReportTeam | null): SelectQueryBuilder<T> {
    if (!team) return qb;
    if (team === HandlingTeam.OPS_SUPPORT) {
        return qb.andWhere(`(${alias}.handlingTeam = :reportTeam OR ${alias}.handlingTeam IS NULL)`, { reportTeam: team });
    }
    if (team === ALL_DEV_TEAM) {
        return qb.andWhere(`${alias}.handlingTeam IN (:...reportTeams)`, { reportTeams: DEV_HANDLING_TEAMS });
    }
    return qb.andWhere(`${alias}.handlingTeam = :reportTeam`, { reportTeam: team });
}

/** Same filter as applyTeamFilter, for repository `find` where-objects. */
export function teamWhere(team?: ReportTeam | null): { handlingTeam?: FindOperator<HandlingTeam> } {
    if (!team) return {};
    if (team === HandlingTeam.OPS_SUPPORT) {
        return { handlingTeam: Or(Equal(HandlingTeam.OPS_SUPPORT), IsNull()) };
    }
    if (team === ALL_DEV_TEAM) {
        return { handlingTeam: In([...DEV_HANDLING_TEAMS]) };
    }
    return { handlingTeam: Equal(team) };
}
