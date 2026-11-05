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
/** HC administrators land on their HC admin area (only CSI HC today). */
export const HC_ADMIN_HOME = '/csi/admin/hc';

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
    if (role === 'HC_ADMIN') return HC_ADMIN_HOME;
    if (isAgentRole(role)) return MY_DASHBOARD_PATH;
    return CLIENT_HOME;
}

/**
 * Deep links built for another portal (e.g. iPop's `/client/tickets/:id`) moved to the same page in the
 * reader's own portal, so an agent following a requester link lands on the ticket instead of /unauthorized.
 * Null when there is no equivalent page.
 */
export function portalEquivalent(path: string, role?: string | null): string | null {
    const ticket = /^\/(?:client\/|manager\/)?tickets\/([0-9a-f-]{8,})(?=[/?#]|$)(.*)$/i.exec(path);
    if (ticket) {
        const [, id, rest] = ticket;
        if (role === 'USER') return `/client/tickets/${id}${rest}`;
        // Managers have no detail page of their own; they open tickets in the agent workspace.
        return `/tickets/${id}${rest}`;
    }
    return null;
}
