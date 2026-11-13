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

    // ─── Customer Satisfaction Index ───────────────────────────────────────────
    csi: {
        all: ['csi'] as const,
        active: () => ['csi', 'me', 'active'] as const,
        forms: () => ['csi', 'me', 'form'] as const,
        form: (id: string) => ['csi', 'me', 'form', id] as const,
        dimensions: (scope: 'ict' | 'hc', includeInactive?: boolean) =>
            ['csi', scope, 'dimensions', ...(includeInactive === undefined ? [] : [includeInactive])] as const,
        departments: (scope: 'ict' | 'hc', includeInactive?: boolean) =>
            ['csi', scope, 'departments', ...(includeInactive === undefined ? [] : [includeInactive])] as const,
        raters: (scope: 'ict' | 'hc') => ['csi', scope, 'raters'] as const,
        memoSettings: (scope: 'ict' | 'hc') => ['csi', scope, 'memo-settings'] as const,
        userSearch: (scope: 'ict' | 'hc', search: string) => ['csi', scope, 'users', search] as const,
        periods: (scope: 'ict' | 'hc', siteId?: string) =>
            ['csi', scope, 'periods', ...(siteId === undefined ? [] : [siteId])] as const,
        /** Prefix of every period detail of a scope (subject master edits change all of them). */
        periodDetails: (scope: 'ict' | 'hc') => ['csi', scope, 'period'] as const,
        period: (scope: 'ict' | 'hc', id: string) => ['csi', scope, 'period', id] as const,
        report: (scope: 'ict' | 'hc', id: string, siteId?: string) =>
            ['csi', scope, 'report', id, ...(siteId === undefined ? [] : [siteId])] as const,
        subjects: (scope: 'ict' | 'hc') => ['csi', scope, 'subjects'] as const,
        questionSets: (scope: 'ict' | 'hc') => ['csi', scope, 'question-sets'] as const,
        overlaps: (scope: 'ict' | 'hc', key: string) => ['csi', scope, 'overlaps', key] as const,
        raterGroup: (scope: 'ict' | 'hc', key: string) => ['csi', scope, 'rater-group', key] as const,
        raterTickets: (scope: 'ict' | 'hc', key: string) => ['csi', scope, 'rater-tickets', key] as const,
        raterDepartments: (scope: 'ict' | 'hc', siteId: string) => ['csi', scope, 'rater-departments', siteId] as const,
        raterMatrix: (scope: 'ict' | 'hc', id: string, siteId?: string) =>
            ['csi', scope, 'rater-matrix', id, ...(siteId === undefined ? [] : [siteId])] as const,
        assignments: (scope: 'ict' | 'hc', periodId: string) => ['csi', scope, 'assignments', periodId] as const,
        dashboard: (scope: 'ict' | 'hc') => ['csi', scope, 'dashboard'] as const,
        respondents: (scope: 'ict' | 'hc', id: string) => ['csi', scope, 'respondents', id] as const,
        responseDetail: (scope: 'ict' | 'hc', id: string, responseId?: string) =>
            ['csi', scope, 'response', id, ...(responseId === undefined ? [] : [responseId])] as const,
    },

    // ─── System & User ─────────────────────────────────────────────────────────
    user: {
        me: () => ['my-profile'] as const,
        all: ['users'] as const,
        list: (filters?: Record<string, any>) => ['users', 'list', filters ?? {}] as const,
    },
} as const;
