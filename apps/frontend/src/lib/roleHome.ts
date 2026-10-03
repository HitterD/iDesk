/** Roles that work tickets; each lands on their own agent dashboard. */
export const AGENT_ROLES = [
    'AGENT',
    'AGENT_ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ORACLE',
    'AGENT_WEB_DEV',
    'AGENT_MOBILE_DEV',
] as const;

export const MY_DASHBOARD_PATH = '/dashboard/me';
export const TEAM_DASHBOARD_PATH = '/dashboard';
const MANAGER_HOME = '/manager/dashboard';
const CLIENT_HOME = '/client/my-tickets';

export const isAgentRole = (role?: string | null): boolean =>
    (AGENT_ROLES as readonly string[]).includes(role ?? '');

/** Path to an agent's dashboard as seen by ADMIN/MANAGER. */
export const agentDashboardPath = (agentId: string): string => `/dashboard/agent/${agentId}`;

/**
 * Single source of truth for where a role lands after login, on `/`, and when a
 * page is denied. Login, RoleBasedRedirect and ProtectedRoute all use it.
 */
export function getRoleHome(role?: string | null): string {
    if (role === 'ADMIN') return TEAM_DASHBOARD_PATH;
    if (role === 'MANAGER') return MANAGER_HOME;
    if (isAgentRole(role)) return MY_DASHBOARD_PATH;
    return CLIENT_HOME;
}
