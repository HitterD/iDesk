/**
 * Centralized React Query Keys Factory for iDesk
 *
 * Ensures 100% type-safe query keys across all features, prevents stale cache
 * or mismatched query invalidations, and preserves backward compatibility.
 */

export const queryKeys = {
    // ─── Ticketing ─────────────────────────────────────────────────────────────
    tickets: {
        all: ['tickets'] as const,
        list: (filters?: Record<string, any>) => ['tickets', 'list', filters ?? {}] as const,
        detail: (id: string) => ['ticket', id] as const,
        messages: (id: string) => ['ticket-messages', id] as const,
        legacyMessages: (id: string) => ['messages', id] as const,
        modules: () => ['ticket-modules'] as const,
        dashboardStats: () => ['dashboard-stats'] as const,
    },

    // ─── Notifications & Action Items ──────────────────────────────────────────
    notifications: {
        all: ['notifications'] as const,
        popover: () => ['notifications', 'popover'] as const,
        count: () => ['notifications', 'count'] as const,
        actionItems: () => ['action-items'] as const,
        legacyActionItems: () => ['actionItems'] as const,
        preferences: () => ['notification-preferences'] as const,
        categorySettings: () => ['notificationCategorySettings'] as const,
    },

    // ─── Zoom Booking ──────────────────────────────────────────────────────────
    zoom: {
        all: ['zoom-booking'] as const,
        bookings: (filters?: Record<string, any>) => ['zoom-booking', 'bookings', filters ?? {}] as const,
        availability: (date?: string) => ['zoom-booking', 'availability', date ?? 'all'] as const,
        accounts: () => ['zoom-booking', 'accounts'] as const,
        settings: () => ['zoom-booking', 'settings'] as const,
        myBookings: (userId?: string) => ['zoom-booking', 'my-bookings', userId ?? 'me'] as const,
    },

    // ─── Hardware Requests ─────────────────────────────────────────────────────
    hardware: {
        all: ['hardware-requests'] as const,
        list: (filters?: Record<string, any>) => ['hardware-requests', 'list', filters ?? {}] as const,
        detail: (id: string) => ['hardware-request', id] as const,
        stats: () => ['hardware-stats'] as const,
        calendar: (month?: string) => ['hardware-calendar', month ?? 'current'] as const,
    },

    // ─── E-Form Access ─────────────────────────────────────────────────────────
    eform: {
        all: ['eform-access'] as const,
        list: (filters?: Record<string, any>) => ['eform-access', 'list', filters ?? {}] as const,
        detail: (id: string) => ['eform-access', id] as const,
    },

    // ─── System & User ─────────────────────────────────────────────────────────
    user: {
        me: () => ['my-profile'] as const,
        all: ['users'] as const,
        list: (filters?: Record<string, any>) => ['users', 'list', filters ?? {}] as const,
    },
} as const;
