// Shared page definitions - SINGLE SOURCE OF TRUTH
// Used by: Backend service, Frontend sidebar, Preset editor

export interface PageDefinition {
    key: string;
    name: string;
    icon: string;
    route: string;
    adminOnly?: boolean;
}

// Pages available for USER role (8 pages)
export const USER_PAGES: PageDefinition[] = [
    { key: 'dashboard', name: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard' },
    { key: 'tickets', name: 'My Tickets', icon: 'Ticket', route: '/tickets' },
    { key: 'hardware_requests', name: 'Hardware Requests', icon: 'MonitorSmartphone', route: '/hardware-requests' },
    { key: 'eform_access', name: 'E-Form Access', icon: 'FileText', route: '/eform-access' },
    { key: 'lost_items', name: 'Lost Items', icon: 'Search', route: '/lost-items' },
    { key: 'zoom_calendar', name: 'Zoom Booking', icon: 'Video', route: '/zoom-calendar' },
    { key: 'knowledge_base', name: 'Knowledge Base', icon: 'BookOpen', route: '/kb' },
    { key: 'notifications', name: 'Notifications', icon: 'Bell', route: '/notifications' },
];

// Pages available for AGENT role (16 pages including admin-only)
export const AGENT_PAGES: PageDefinition[] = [
    { key: 'dashboard', name: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard' },
    { key: 'tickets', name: 'All Tickets', icon: 'Ticket', route: '/tickets' },
    { key: 'hardware_requests', name: 'Hardware Requests', icon: 'MonitorSmartphone', route: '/hardware-requests' },
    { key: 'eform_access', name: 'E-Form Access', icon: 'FileText', route: '/eform-access' },
    { key: 'lost_items', name: 'Lost Items', icon: 'Search', route: '/lost-items' },
    { key: 'zoom_calendar', name: 'Zoom Management', icon: 'Video', route: '/zoom-calendar' },
    { key: 'knowledge_base', name: 'KB Management', icon: 'BookOpen', route: '/kb' },
    { key: 'notifications', name: 'Notifications', icon: 'Bell', route: '/notifications' },
    { key: 'reports', name: 'Reports', icon: 'BarChart3', route: '/reports' },
    { key: 'renewal', name: 'Renewal Hub', icon: 'RefreshCw', route: '/renewal' },
    // Admin-only pages
    { key: 'agents', name: 'Agents', icon: 'Users', route: '/agents', adminOnly: true },
    { key: 'workloads', name: 'Workloads', icon: 'Activity', route: '/workloads', adminOnly: true },
    { key: 'automation', name: 'Automation', icon: 'Zap', route: '/automation', adminOnly: true },
    { key: 'audit_logs', name: 'Audit Logs', icon: 'Shield', route: '/audit-logs', adminOnly: true },
    { key: 'system_health', name: 'System Health', icon: 'Activity', route: '/system-health', adminOnly: true },
    { key: 'settings', name: 'Settings', icon: 'Settings', route: '/settings', adminOnly: true },
];

// Pages available for MANAGER role (11 pages)
export const MANAGER_PAGES: PageDefinition[] = [
    { key: 'dashboard', name: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard' },
    { key: 'tickets', name: 'Team Tickets', icon: 'Ticket', route: '/tickets' },
    { key: 'hardware_requests', name: 'Hardware Requests', icon: 'MonitorSmartphone', route: '/hardware-requests' },
    { key: 'eform_access', name: 'E-Form Access', icon: 'FileText', route: '/eform-access' },
    { key: 'lost_items', name: 'Lost Items', icon: 'Search', route: '/lost-items' },
    { key: 'zoom_calendar', name: 'Zoom Calendar', icon: 'Video', route: '/zoom-calendar' },
    { key: 'reports', name: 'Reports', icon: 'BarChart3', route: '/reports' },
    { key: 'knowledge_base', name: 'Knowledge Base', icon: 'BookOpen', route: '/kb' },
    { key: 'renewal', name: 'Renewal Hub', icon: 'RefreshCw', route: '/renewal' },
    { key: 'notifications', name: 'Notifications', icon: 'Bell', route: '/notifications' },
    { key: 'workloads', name: 'Workloads', icon: 'Activity', route: '/workloads' },
];

export type TargetRole = 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN';

// Get pages for a specific role
export function getPagesForRole(role: TargetRole): PageDefinition[] {
    switch (role) {
        case 'USER': return USER_PAGES;
        case 'MANAGER': return MANAGER_PAGES;
        case 'AGENT':
        case 'ADMIN':
        default: return AGENT_PAGES;
    }
}

// Get default page access (all pages enabled) for a role
export function getDefaultPageAccess(role: TargetRole): Record<string, boolean> {
    const pages = getPagesForRole(role);
    const access: Record<string, boolean> = {};
    // Don't include admin-only pages for non-admin roles
    pages.filter(p => role === 'ADMIN' || !p.adminOnly).forEach(p => {
        access[p.key] = true;
    });
    return access;
}

// Get role default pages as array (for sidebar fallback)
export function getRoleDefaultPageKeys(role: string): string[] {
    const roleMap: Record<string, string[]> = {
        USER: USER_PAGES.map(p => p.key),
        AGENT: AGENT_PAGES.filter(p => !p.adminOnly).map(p => p.key),
        MANAGER: MANAGER_PAGES.map(p => p.key),
        ADMIN: AGENT_PAGES.map(p => p.key),
    };
    return roleMap[role] || roleMap['USER'];
}
