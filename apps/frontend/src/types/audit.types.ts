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

    // === PAGE ACCESS CONTROL ===
    PAGE_ACCESS_DENIED = 'PAGE_ACCESS_DENIED',
    PAGE_ACCESS_LOCKOUT = 'PAGE_ACCESS_LOCKOUT',

    // === ACCESS REQUEST ===
    ACCESS_REQUEST_CREATE = 'ACCESS_REQUEST_CREATE',
    ACCESS_REQUEST_APPROVE = 'ACCESS_REQUEST_APPROVE',
    ACCESS_REQUEST_REJECT = 'ACCESS_REQUEST_REJECT',
    ACCESS_TYPE_UPDATE = 'ACCESS_TYPE_UPDATE',

    // === E-FORM ===
    EFORM_REQUEST_CREATE = 'EFORM_REQUEST_CREATE',
    EFORM_APPROVE_MANAGER1 = 'EFORM_APPROVE_MANAGER1',
    EFORM_APPROVE_MANAGER2 = 'EFORM_APPROVE_MANAGER2',
    EFORM_REJECT = 'EFORM_REJECT',

    // === ICT BUDGET / HARDWARE REQUEST ===
    ICT_BUDGET_CREATE = 'ICT_BUDGET_CREATE',
    ICT_BUDGET_APPROVE = 'ICT_BUDGET_APPROVE',
    ICT_BUDGET_CANCEL = 'ICT_BUDGET_CANCEL',

    // === VPN ACCESS ===
    VPN_ACCESS_CREATE = 'VPN_ACCESS_CREATE',
    VPN_ACCESS_UPDATE = 'VPN_ACCESS_UPDATE',
    VPN_ACCESS_DELETE = 'VPN_ACCESS_DELETE',

    // === LOST & FOUND ===
    LOST_ITEM_CREATE = 'LOST_ITEM_CREATE',
    LOST_ITEM_STATUS_UPDATE = 'LOST_ITEM_STATUS_UPDATE',

    // === CONTRACT RENEWAL ===
    CONTRACT_CREATE = 'CONTRACT_CREATE',
    CONTRACT_UPDATE = 'CONTRACT_UPDATE',
    CONTRACT_DELETE = 'CONTRACT_DELETE',

    // === AUTOMATION ===
    AUTOMATION_TOGGLE = 'AUTOMATION_TOGGLE',

    // === PERMISSIONS ===
    PERMISSION_UPDATE = 'PERMISSION_UPDATE',
    PERMISSION_PRESET_CREATE = 'PERMISSION_PRESET_CREATE',
    PERMISSION_PRESET_UPDATE = 'PERMISSION_PRESET_UPDATE',
    PERMISSION_PRESET_DELETE = 'PERMISSION_PRESET_DELETE',

    // === SITES ===
    SITE_CREATE = 'SITE_CREATE',
    SITE_UPDATE = 'SITE_UPDATE',
    SITE_DELETE = 'SITE_DELETE',

    // === SLA CONFIG / BUSINESS HOURS ===
    BUSINESS_HOURS_UPDATE = 'BUSINESS_HOURS_UPDATE',
    HOLIDAY_REMOVE = 'HOLIDAY_REMOVE',

    // === IP WHITELIST ===
    IP_WHITELIST_CREATE = 'IP_WHITELIST_CREATE',
    IP_WHITELIST_UPDATE = 'IP_WHITELIST_UPDATE',
    IP_WHITELIST_DELETE = 'IP_WHITELIST_DELETE',

    // === GOOGLE SYNC ===
    SYNC_CONFIG_CREATE = 'SYNC_CONFIG_CREATE',
    SYNC_CONFIG_UPDATE = 'SYNC_CONFIG_UPDATE',
    SYNC_CONFIG_DELETE = 'SYNC_CONFIG_DELETE',

    // === TICKET SUPPORT ===
    TICKET_TEMPLATE_CREATE = 'TICKET_TEMPLATE_CREATE',
    TICKET_TEMPLATE_UPDATE = 'TICKET_TEMPLATE_UPDATE',
    TICKET_TEMPLATE_DELETE = 'TICKET_TEMPLATE_DELETE',
    TICKET_ATTRIBUTE_CREATE = 'TICKET_ATTRIBUTE_CREATE',
    TICKET_ATTRIBUTE_DELETE = 'TICKET_ATTRIBUTE_DELETE',
    TIME_ENTRY_CREATE = 'TIME_ENTRY_CREATE',
    TIME_ENTRY_UPDATE = 'TIME_ENTRY_UPDATE',
    TIME_ENTRY_DELETE = 'TIME_ENTRY_DELETE',

    // === INSTALLATION ===
    INSTALLATION_SCHEDULE_CREATE = 'INSTALLATION_SCHEDULE_CREATE',

    // === WORKLOAD ===
    WORKLOAD_PRIORITY_UPDATE = 'WORKLOAD_PRIORITY_UPDATE',

    // === NOTIFICATIONS ===  
    NOTIFICATION_PREFS_UPDATE = 'NOTIFICATION_PREFS_UPDATE',
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

    // Page Access Control
    [AuditAction.PAGE_ACCESS_DENIED]: { label: 'Access Denied', icon: '🚫', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.PAGE_ACCESS_LOCKOUT]: { label: 'Access Lockout', icon: '🔒', color: 'text-red-600', bgColor: 'bg-red-700/20' },

    // Access Request
    [AuditAction.ACCESS_REQUEST_CREATE]: { label: 'Request Created', icon: '📝', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.ACCESS_REQUEST_APPROVE]: { label: 'Request Approved', icon: '✅', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.ACCESS_REQUEST_REJECT]: { label: 'Request Rejected', icon: '❌', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.ACCESS_TYPE_UPDATE]: { label: 'Access Type Updated', icon: '🔄', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },

    // E-Form
    [AuditAction.EFORM_REQUEST_CREATE]: { label: 'E-Form Created', icon: '📄', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.EFORM_APPROVE_MANAGER1]: { label: 'Mgr 1 Approved', icon: '✅', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.EFORM_APPROVE_MANAGER2]: { label: 'Mgr 2 Approved', icon: '✅', color: 'text-green-500', bgColor: 'bg-green-600/20' },
    [AuditAction.EFORM_REJECT]: { label: 'E-Form Rejected', icon: '❌', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // ICT Budget
    [AuditAction.ICT_BUDGET_CREATE]: { label: 'Budget Request', icon: '💰', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.ICT_BUDGET_APPROVE]: { label: 'Budget Approved', icon: '✅', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.ICT_BUDGET_CANCEL]: { label: 'Budget Cancelled', icon: '❌', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // VPN Access
    [AuditAction.VPN_ACCESS_CREATE]: { label: 'VPN Access Created', icon: '🌐', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.VPN_ACCESS_UPDATE]: { label: 'VPN Access Updated', icon: '🔄', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.VPN_ACCESS_DELETE]: { label: 'VPN Access Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Lost & Found
    [AuditAction.LOST_ITEM_CREATE]: { label: 'Lost Item Logged', icon: '🔍', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.LOST_ITEM_STATUS_UPDATE]: { label: 'Lost Item Status', icon: '🔄', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },

    // Contract Renewal
    [AuditAction.CONTRACT_CREATE]: { label: 'Contract Created', icon: '📜', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.CONTRACT_UPDATE]: { label: 'Contract Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.CONTRACT_DELETE]: { label: 'Contract Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Automation Toggle
    [AuditAction.AUTOMATION_TOGGLE]: { label: 'Automation Toggled', icon: '🔄', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },

    // Permissions
    [AuditAction.PERMISSION_UPDATE]: { label: 'Permission Updated', icon: '🔐', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    [AuditAction.PERMISSION_PRESET_CREATE]: { label: 'Preset Created', icon: '📝', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.PERMISSION_PRESET_UPDATE]: { label: 'Preset Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.PERMISSION_PRESET_DELETE]: { label: 'Preset Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Sites
    [AuditAction.SITE_CREATE]: { label: 'Site Created', icon: '🏢', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.SITE_UPDATE]: { label: 'Site Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.SITE_DELETE]: { label: 'Site Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // SLA / Business Hours
    [AuditAction.BUSINESS_HOURS_UPDATE]: { label: 'Biz Hours Updated', icon: '⏱️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.HOLIDAY_REMOVE]: { label: 'Holiday Removed', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // IP Whitelist
    [AuditAction.IP_WHITELIST_CREATE]: { label: 'IP Whitelisted', icon: '🌐', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.IP_WHITELIST_UPDATE]: { label: 'IP WL Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.IP_WHITELIST_DELETE]: { label: 'IP WL Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Google Sync
    [AuditAction.SYNC_CONFIG_CREATE]: { label: 'Sync Config Created', icon: '☁️', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.SYNC_CONFIG_UPDATE]: { label: 'Sync Config Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.SYNC_CONFIG_DELETE]: { label: 'Sync Config Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Ticket Support
    [AuditAction.TICKET_TEMPLATE_CREATE]: { label: 'Template Created', icon: '📑', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.TICKET_TEMPLATE_UPDATE]: { label: 'Template Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.TICKET_TEMPLATE_DELETE]: { label: 'Template Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.TICKET_ATTRIBUTE_CREATE]: { label: 'Attribute Created', icon: '🏷️', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    [AuditAction.TICKET_ATTRIBUTE_DELETE]: { label: 'Attribute Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    [AuditAction.TIME_ENTRY_CREATE]: { label: 'Time Logged', icon: '⏳', color: 'text-green-400', bgColor: 'bg-green-500/20' },
    [AuditAction.TIME_ENTRY_UPDATE]: { label: 'Time Updated', icon: '✏️', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    [AuditAction.TIME_ENTRY_DELETE]: { label: 'Time Deleted', icon: '🗑️', color: 'text-red-400', bgColor: 'bg-red-500/20' },

    // Installation
    [AuditAction.INSTALLATION_SCHEDULE_CREATE]: { label: 'Install Scheduled', icon: '📅', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },

    // Workload
    [AuditAction.WORKLOAD_PRIORITY_UPDATE]: { label: 'Workload Updated', icon: '⚖️', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },

    // Notifications
    [AuditAction.NOTIFICATION_PREFS_UPDATE]: { label: 'Notif Prefs Updated', icon: '🔔', color: 'text-gray-400', bgColor: 'bg-gray-500/20' }
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
