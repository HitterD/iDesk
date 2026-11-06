/**
 * Report team scope — mirrors backend `report-team-scope.util.ts`.
 * Metrics follow ticket handlingTeam, including contributions from agents whose home site differs.
 */
export const REPORT_TEAMS = ['OPS_SUPPORT', 'ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV', 'ALL_DEV'] as const;
export type ReportTeam = (typeof REPORT_TEAMS)[number];

export const REPORT_TEAM_LABELS: Record<ReportTeam, string> = {
    OPS_SUPPORT: 'IT Support',
    ORACLE_DEV: 'Oracle / K2',
    WEB_DEV: 'Web Dev',
    MOBILE_DEV: 'Mobile Dev',
    ALL_DEV: 'Semua Tim Dev',
};
export const ALL_TEAMS_LABEL = 'Semua Tim';
/** Team filter of every manager page, in one order: all, IT Support, all developer teams, each developer team. */
export const TEAM_FILTER_ORDER: readonly ReportTeam[] = ['OPS_SUPPORT', 'ALL_DEV', 'ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV'];
const DEV_TEAMS: readonly ReportTeam[] = ['ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV'];

/** Whether a role-derived team falls under the picked filter (ALL_DEV covers every developer team). */
export function teamMatches(filter: ReportTeam | null | undefined, team: ReportTeam | undefined): boolean {
    if (!filter) return true;
    if (filter === 'ALL_DEV') return !!team && DEV_TEAMS.includes(team);
    return team === filter;
}
/** Every report team today belongs to the ICT department scope. */
export const REPORT_TEAMS_SCOPE_TITLE = 'Tim ICT';

const ROLE_TEAM: Record<string, ReportTeam> = {
    AGENT: 'OPS_SUPPORT',
    AGENT_ADMIN: 'OPS_SUPPORT',
    AGENT_OPERATIONAL_SUPPORT: 'OPS_SUPPORT',
    AGENT_ORACLE: 'ORACLE_DEV',
    AGENT_WEB_DEV: 'WEB_DEV',
    AGENT_MOBILE_DEV: 'MOBILE_DEV',
};

/** Team an agent is locked to; undefined for roles free to pick (ADMIN/MANAGER). */
export function lockedTeamForRole(role?: string | null): ReportTeam | undefined {
    return role ? ROLE_TEAM[role] : undefined;
}

export function reportTeamLabel(team?: ReportTeam | null): string {
    return team ? REPORT_TEAM_LABELS[team] : ALL_TEAMS_LABEL;
}

/** `&team=X` query fragment, empty when every team is selected. */
export function teamQueryParam(team?: ReportTeam | null): string {
    return team ? `&team=${team}` : '';
}
