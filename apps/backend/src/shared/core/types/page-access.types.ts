/**
 * Page Access Types
 * Centralized page key definitions for preset-based authorization
 */

// Valid page keys that can be used in pageAccess
export const VALID_PAGE_KEYS = [
    'dashboard',
    'my_dashboard',
    'tickets',
    'zoom_calendar',
    'knowledge_base',
    'notifications',
    'reports',
    'renewal',
    'agents',
    'automation',
    'audit_logs',
    'system_health',
    'settings',
    'oracle_k2_tickets',
    'web_dev_tickets',
    'mobile_dev_tickets',
    'hardware_requests',
    'eform_access',
    'workloads',
    'ict_budget',
    'data_wipe',
    'csi_admin_ict',
    'csi_admin_hc',
] as const;

// Type for valid page keys
export type PageKey = typeof VALID_PAGE_KEYS[number];

// PageAccess object type
export type PageAccess = Partial<Record<PageKey, boolean>>;

// Check if a string is a valid page key
export function isValidPageKey(key: string): key is PageKey {
    return VALID_PAGE_KEYS.includes(key as PageKey);
}

const USER_DEFAULT_PAGES: readonly PageKey[] = [
    'dashboard', 'tickets', 'knowledge_base', 'notifications', 'hardware_requests', 'eform_access',
];
const AGENT_DEFAULT_PAGES: readonly PageKey[] = [
    ...USER_DEFAULT_PAGES, 'my_dashboard', 'zoom_calendar', 'reports', 'renewal',
];
const DEVELOPER_AGENT_DEFAULT_PAGES: readonly PageKey[] = [
    'my_dashboard', 'oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'notifications', 'reports',
];
/** Managers get the agent pages minus the personal agent dashboard, plus workloads. */
const MANAGER_DEFAULT_PAGES: readonly PageKey[] = [
    ...AGENT_DEFAULT_PAGES.filter((page) => page !== 'my_dashboard'), 'workloads',
];

const DEFAULT_PAGES_BY_ROLE: Record<string, readonly PageKey[]> = {
    USER: USER_DEFAULT_PAGES,
    AGENT: AGENT_DEFAULT_PAGES,
    AGENT_ADMIN: AGENT_DEFAULT_PAGES,
    AGENT_OPERATIONAL_SUPPORT: AGENT_DEFAULT_PAGES,
    AGENT_ORACLE: DEVELOPER_AGENT_DEFAULT_PAGES,
    AGENT_WEB_DEV: DEVELOPER_AGENT_DEFAULT_PAGES,
    AGENT_MOBILE_DEV: DEVELOPER_AGENT_DEFAULT_PAGES,
    MANAGER: MANAGER_DEFAULT_PAGES,
    ADMIN: VALID_PAGE_KEYS.filter(k => k !== 'csi_admin_hc'),
};

/**
 * Page access for a user WITHOUT an applied preset.
 * Mirrors the system presets so the UI (/permissions/me) and PageAccessGuard agree,
 * and never grants admin-only pages to non-admin roles. Unknown roles get USER access.
 */
export function getRoleDefaultPageAccess(role?: string | null): PageAccess {
    const pages = DEFAULT_PAGES_BY_ROLE[role ?? ''] ?? USER_DEFAULT_PAGES;
    return Object.fromEntries(pages.map((page) => [page, true])) as PageAccess;
}
