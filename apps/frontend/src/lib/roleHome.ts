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

/** Path prefix of each role's portal: requesters use /client, managers /manager, everyone else the staff portal. */
export function portalPrefix(role?: string | null): string {
    if (role === 'USER') return '/client';
    if (role === 'MANAGER') return '/manager';
    return '';
}

/** Old or mistyped links still stored in notifications and emails, mapped to the page that exists today. */
const LEGACY_LINKS: ReadonlyArray<[RegExp, string]> = [
    [/^\/vpn-access(?:\/.*)?$/, '/renewal?tab=vpn'],
    [/^\/renewals(?:\/.*)?$/, '/renewal?tab=contracts'],
    [/^\/eform\/requests\/([^/]+)$/, '/eform-access/$1'],
    [/^\/zoom$/, '/zoom-calendar'],
    [/^\/zoom-booking\/([^/]+)$/, '/zoom-calendar?booking=$1'],
    [/^\/admin\//, '/'],
];

/** Modules with the same pages in every portal (staff, /manager and /client). */
const SHARED_MODULE = /^\/(?:hardware-requests|eform-access|zoom-calendar|csi)(?=[/?#]|$)/;
/** Modules that exist only in the staff and manager portals. */
const STAFF_MODULE = /^\/renewal(?=[/?#]|$)/;
/** Ticket list routes that share the `/tickets/` prefix; anything else after it is a ticket id. */
const TICKET_LIST_SEGMENTS = new Set(['list', 'create', 'queue', 'oracle-k2', 'web-developer', 'mobile-developer']);
const TICKET_PATH = /^\/tickets\/([^/?#]+)(.*)$/;

function ticketDetail(path: string): [string, string] | null {
    const match = TICKET_PATH.exec(path);
    if (!match || TICKET_LIST_SEGMENTS.has(match[1])) return null;
    return [match[1], match[2]];
}

function splitSuffix(path: string): [string, string] {
    const cut = path.search(/[?#]/);
    return cut < 0 ? [path, ''] : [path.slice(0, cut), path.slice(cut)];
}

/** Strips the portal prefix and rewrites legacy links, giving the staff-portal form of a path. */
function canonicalPath(path: string): string {
    const [pathname, suffix] = splitSuffix(path);
    const bare = pathname.replace(/^\/(?:client|manager)(?=\/)/, '');
    for (const [pattern, target] of LEGACY_LINKS) {
        if (pattern.test(bare)) {
            const rewritten = bare.replace(pattern, target);
            const [rPath, rSuffix] = splitSuffix(rewritten);
            return rPath + mergeSuffix(rSuffix, suffix);
        }
    }
    return bare + suffix;
}

function mergeSuffix(a: string, b: string): string {
    if (!a) return b;
    if (!b) return a;
    const [aQuery, aHash = ''] = a.split('#');
    const [bQuery, bHash = ''] = b.split('#');
    const query = new URLSearchParams(aQuery.replace(/^\?/, ''));
    new URLSearchParams(bQuery.replace(/^\?/, '')).forEach((value, key) => query.set(key, value));
    const qs = query.toString();
    const hash = bHash || aHash;
    return `${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`;
}

/**
 * Deep links built for another portal (notification links are written in staff-portal form, iPop links in
 * client form) moved to the same page in the reader's own portal, so following a link lands on the page
 * instead of /unauthorized or the home page. Null when there is no equivalent page for that role.
 */
export function portalEquivalent(path: string, role?: string | null): string | null {
    const canonical = canonicalPath(path);
    const ticket = ticketDetail(canonical);
    if (ticket) {
        const [id, rest] = ticket;
        // Managers have no detail page of their own; they open tickets in the agent workspace.
        return role === 'USER' ? `/client/tickets/${id}${rest}` : `/tickets/${id}${rest}`;
    }
    if (SHARED_MODULE.test(canonical)) return `${portalPrefix(role)}${canonical}`;
    if (STAFF_MODULE.test(canonical)) return role === 'USER' ? null : `${portalPrefix(role)}${canonical}`;
    return null;
}
