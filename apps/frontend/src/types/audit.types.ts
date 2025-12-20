// Audit Log Types (synced with backend)
// c:\iDesk\apps\backend\src\modules\audit\entities\audit-log.entity.ts

export enum AuditAction {
    // === AUTHENTICATION ===
    USER_LOGIN = 'USER_LOGIN',
    USER_LOGOUT = 'USER_LOGOUT',
    LOGIN_FAILED = 'LOGIN_FAILED',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    PASSWORD_RESET = 'PASSWORD_RESET',

    // === USER MANAGEMENT ===
    USER_CREATE = 'USER_CREATE',
    USER_UPDATE = 'USER_UPDATE',
    USER_DELETE = 'USER_DELETE',
    USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
    USER_BULK_IMPORT = 'USER_BULK_IMPORT',
    USER_STATUS_TOGGLE = 'USER_STATUS_TOGGLE',

    // === TICKETS ===
    CREATE_TICKET = 'CREATE_TICKET',
    UPDATE_TICKET = 'UPDATE_TICKET',
    DELETE_TICKET = 'DELETE_TICKET',
    ASSIGN_TICKET = 'ASSIGN_TICKET',
    STATUS_CHANGE = 'STATUS_CHANGE',
    PRIORITY_CHANGE = 'PRIORITY_CHANGE',
    TICKET_REPLY = 'TICKET_REPLY',
    TICKET_MERGE = 'TICKET_MERGE',
    TICKET_CANCEL = 'TICKET_CANCEL',
    BULK_UPDATE = 'BULK_UPDATE',

    // === KNOWLEDGE BASE ===
    ARTICLE_CREATE = 'ARTICLE_CREATE',
    ARTICLE_UPDATE = 'ARTICLE_UPDATE',
    ARTICLE_DELETE = 'ARTICLE_DELETE',
    ARTICLE_PUBLISH = 'ARTICLE_PUBLISH',

    // === SETTINGS ===
    SETTINGS_CHANGE = 'SETTINGS_CHANGE',
    SLA_CONFIG_CHANGE = 'SLA_CONFIG_CHANGE',

    // === ZOOM BOOKING ===
    ZOOM_BOOKING_CREATE = 'ZOOM_BOOKING_CREATE',
    ZOOM_BOOKING_CANCEL = 'ZOOM_BOOKING_CANCEL',
    ZOOM_BOOKING_RESCHEDULE = 'ZOOM_BOOKING_RESCHEDULE',

    // === AUTOMATION ===
    AUTOMATION_CREATE = 'AUTOMATION_CREATE',
    AUTOMATION_UPDATE = 'AUTOMATION_UPDATE',
    AUTOMATION_DELETE = 'AUTOMATION_DELETE',

    // === REPORTS ===
    REPORT_GENERATE = 'REPORT_GENERATE',
    REPORT_EXPORT = 'REPORT_EXPORT',
}

export interface AuditUser {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
}

export interface AuditLog {
    id: string;
    userId: string;
    user?: AuditUser;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

export interface AuditStats {
    totalLogs: number;
    loginsToday: number;
    changesLast24h: number;
    failedAuthAttempts: number;
    topActions: { action: string; count: number }[];
}

export interface AuditLogsResponse {
    data: AuditLog[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface AuditQueryParams {
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
    page?: number;
    limit?: number;
}

// Action display configuration
export interface ActionConfig {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
}

export const AUDIT_ACTION_CONFIG: Record<AuditAction, ActionConfig> = {
    // Auth
    [AuditAction.USER_LOGIN]: { label: 'Login', icon: '🔑', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.USER_LOGOUT]: { label: 'Logout', icon: '🚪', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
    [AuditAction.LOGIN_FAILED]: { label: 'Failed Login', icon: '⚠️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.PASSWORD_CHANGE]: { label: 'Password Changed', icon: '🔐', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.PASSWORD_RESET]: { label: 'Password Reset', icon: '🔄', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },

    // Users
    [AuditAction.USER_CREATE]: { label: 'User Created', icon: '👤', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.USER_UPDATE]: { label: 'User Updated', icon: '✏️', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.USER_DELETE]: { label: 'User Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.USER_ROLE_CHANGE]: { label: 'Role Changed', icon: '👑', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    [AuditAction.USER_BULK_IMPORT]: { label: 'Bulk Import', icon: '📥', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    [AuditAction.USER_STATUS_TOGGLE]: { label: 'Status Toggle', icon: '🔘', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },

    // Tickets
    [AuditAction.CREATE_TICKET]: { label: 'Ticket Created', icon: '🎫', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.UPDATE_TICKET]: { label: 'Ticket Updated', icon: '📝', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.DELETE_TICKET]: { label: 'Ticket Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.ASSIGN_TICKET]: { label: 'Ticket Assigned', icon: '👉', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    [AuditAction.STATUS_CHANGE]: { label: 'Status Changed', icon: '🔄', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.PRIORITY_CHANGE]: { label: 'Priority Changed', icon: '⚡', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    [AuditAction.TICKET_REPLY]: { label: 'Reply', icon: '💬', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.TICKET_MERGE]: { label: 'Tickets Merged', icon: '🔗', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    [AuditAction.TICKET_CANCEL]: { label: 'Ticket Cancelled', icon: '❌', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.BULK_UPDATE]: { label: 'Bulk Update', icon: '📦', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },

    // Knowledge Base
    [AuditAction.ARTICLE_CREATE]: { label: 'Article Created', icon: '📄', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.ARTICLE_UPDATE]: { label: 'Article Updated', icon: '✏️', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.ARTICLE_DELETE]: { label: 'Article Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.ARTICLE_PUBLISH]: { label: 'Article Published', icon: '📢', color: 'text-green-400', bgColor: 'bg-green-500/20' },

    // Settings
    [AuditAction.SETTINGS_CHANGE]: { label: 'Settings Changed', icon: '⚙️', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
    [AuditAction.SLA_CONFIG_CHANGE]: { label: 'SLA Config', icon: '⏱️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },

    // Zoom
    [AuditAction.ZOOM_BOOKING_CREATE]: { label: 'Zoom Booked', icon: '📹', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.ZOOM_BOOKING_CANCEL]: { label: 'Zoom Cancelled', icon: '📹', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.ZOOM_BOOKING_RESCHEDULE]: { label: 'Zoom Rescheduled', icon: '📹', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },

    // Automation
    [AuditAction.AUTOMATION_CREATE]: { label: 'Automation Created', icon: '🤖', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.AUTOMATION_UPDATE]: { label: 'Automation Updated', icon: '🤖', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.AUTOMATION_DELETE]: { label: 'Automation Deleted', icon: '🤖', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Reports
    [AuditAction.REPORT_GENERATE]: { label: 'Report Generated', icon: '📊', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    [AuditAction.REPORT_EXPORT]: { label: 'Report Exported', icon: '📤', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
};

// Entity type display names
export const ENTITY_TYPE_LABELS: Record<string, string> = {
    user: 'User',
    ticket: 'Ticket',
    article: 'Article',
    auth: 'Authentication',
    settings: 'Settings',
    sla: 'SLA Config',
    zoom: 'Zoom Booking',
    automation: 'Automation',
    report: 'Report',
};
