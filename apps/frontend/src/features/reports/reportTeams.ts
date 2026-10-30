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
