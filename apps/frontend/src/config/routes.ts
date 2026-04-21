/**
 * Centralized Route Paths Configuration
 * 
 * Use these constants instead of hardcoded strings for type-safe navigation.
 * This enables easier refactoring and prevents typos in route paths.
 * 
 * Usage:
 * import { ROUTES } from '@/config/routes';
 * navigate(ROUTES.DASHBOARD);
 * <Link to={ROUTES.TICKETS.LIST}>Tickets</Link>
 */

// ==========================================
// Admin/Agent Portal Routes
// ==========================================
export const ROUTES = {
    // Public
    LOGIN: '/login',
    UNAUTHORIZED: '/unauthorized',
    FEEDBACK: (token: string) => `/feedback/${token}`,

    // Dashboard
    ROOT: '/',
    DASHBOARD: '/dashboard',
    HARDWARE_INSTALLATION: '/hardware-installation',

    // Tickets
    TICKETS: {
        LIST: '/tickets/list',
        DETAIL: (id: string) => `/tickets/${id}`,
        CREATE: '/tickets/create',
        KANBAN: '/kanban',
    },

    // Knowledge Base
    KB: {
        ROOT: '/kb',
        ARTICLE: (slug: string) => `/kb/${slug}`,
        MANAGE: '/kb/manage',
        EDIT: (id: string) => `/kb/edit/${id}`,
    },

    // Admin Only
    ADMIN: {
        WORKLOADS: '/workloads',
        SETTINGS: '/settings',
        AGENTS: '/agents',
        REPORTS: '/reports',
        AUDIT_LOGS: '/audit-logs',
        SYSTEM_HEALTH: '/system-health',
        AUTOMATION: '/automation',
        SLA: '/sla',
        STORAGE: '/storage',
        ZOOM_SETTINGS: '/zoom',
    },

    // Features
    ZOOM_CALENDAR: '/zoom-calendar',
    RENEWAL: '/renewal',
    NOTIFICATIONS: '/notifications',
} as const;

// ==========================================
// Client Portal Routes
// ==========================================
export const CLIENT_ROUTES = {
    ROOT: '/client',
    MY_TICKETS: '/client/my-tickets',
    TICKET_DETAIL: (id: string) => `/client/ticket/${id}`,
    CREATE_TICKET: '/client/create',
    ZOOM_CALENDAR: '/client/zoom-calendar',
    KB: '/client/kb',
    KB_ARTICLE: (slug: string) => `/client/kb/${slug}`,
    PROFILE: '/client/profile',
    NOTIFICATIONS: '/client/notifications',
} as const;

// ==========================================
// Manager Portal Routes
// ==========================================
export const MANAGER_ROUTES = {
    ROOT: '/manager',
    DASHBOARD: '/manager/dashboard',
    WORKLOADS: '/manager/workloads',
    TICKETS: '/manager/tickets',
    TICKET_DETAIL: (id: string) => `/manager/ticket/${id}`,
    ZOOM_CALENDAR: '/manager/zoom-calendar',
    REPORTS: '/manager/reports',
    KB: '/manager/kb',
} as const;

// ==========================================
// API Endpoints (for reference)
// ==========================================
export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        REGISTER: '/auth/register',
        CSRF_TOKEN: '/auth/csrf-token',
        CHANGE_PASSWORD: '/auth/change-password',
    },
    USERS: '/users',
    TICKETS: '/tickets',
    KB: '/kb',
    NOTIFICATIONS: '/notifications',
    SETTINGS: '/settings',
    REPORTS: '/reports',
    ZOOM: '/zoom',
    RENEWAL: '/renewal',
    AUDIT: '/audit',
} as const;

// ==========================================
// Route Helpers
// ==========================================

/**
 * Check if current path matches a route pattern
 */
export function matchRoute(currentPath: string, pattern: string): boolean {
    // Handle dynamic segments (e.g., /tickets/:id)
    const regexPattern = pattern
        .replace(/:[^/]+/g, '[^/]+')  // Replace :param with regex
        .replace(/\//g, '\\/');        // Escape slashes

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(currentPath);
}

/**
 * Get breadcrumb-friendly route names
 */
export const ROUTE_NAMES: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/tickets/list': 'Tickets',
    '/tickets/create': 'Create Ticket',
    '/kanban': 'Kanban Board',
    '/kb': 'Knowledge Base',
    '/kb/manage': 'Manage Articles',
    '/settings': 'Settings',
    '/agents': 'Agent Management',
    '/reports': 'Reports',
    '/audit-logs': 'Audit Logs',
    '/system-health': 'System Health',
    '/automation': 'Automation',
    '/renewal': 'Renewal Hub',
    '/notifications': 'Notifications',
    '/zoom-calendar': 'Zoom Calendar',
    '/sla': 'SLA Settings',
    '/storage': 'Storage',
    '/zoom': 'Zoom Settings',
};

/**
 * Get route name from path
 */
export function getRouteName(path: string): string {
    // Check exact match first
    if (ROUTE_NAMES[path]) {
        return ROUTE_NAMES[path];
    }

    // Check for dynamic routes
    const basePath = path.replace(/\/[a-zA-Z0-9-]+$/, '');
    if (ROUTE_NAMES[basePath]) {
        return ROUTE_NAMES[basePath];
    }

    // Extract last segment and capitalize
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, ' ');
}
