/**
 * Standardized Error Codes Enum
 * 
 * Format: {DOMAIN}_{CODE}
 * - AUTH: Authentication & Authorization
 * - TKT: Tickets
 * - USR: Users
 * - VAL: Validation
 * - SYS: System
 * - CSRF: CSRF Protection
 * - RATE: Rate Limiting
 * - ZOOM: Zoom Integration
 * - KB: Knowledge Base
 * - NTF: Notifications
 */
export enum ErrorCode {
    // ==========================================
    // AUTH - Authentication & Authorization
    // ==========================================
    AUTH_INVALID_CREDENTIALS = 'AUTH_001',
    AUTH_TOKEN_EXPIRED = 'AUTH_002',
    AUTH_TOKEN_INVALID = 'AUTH_003',
    AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_004',
    AUTH_USER_DISABLED = 'AUTH_005',
    AUTH_SESSION_EXPIRED = 'AUTH_006',
    AUTH_MFA_REQUIRED = 'AUTH_007',
    AUTH_PASSWORD_MISMATCH = 'AUTH_008',
    AUTH_PASSWORD_TOO_WEAK = 'AUTH_009',

    // ==========================================
    // CSRF - Cross-Site Request Forgery
    // ==========================================
    CSRF_TOKEN_MISSING = 'CSRF_001',
    CSRF_TOKEN_INVALID = 'CSRF_002',
    CSRF_TOKEN_EXPIRED = 'CSRF_003',

    // ==========================================
    // RATE - Rate Limiting
    // ==========================================
    RATE_LIMIT_EXCEEDED = 'RATE_001',
    RATE_WS_CONNECTION_EXCEEDED = 'RATE_002',
    RATE_WS_MESSAGE_EXCEEDED = 'RATE_003',

    // ==========================================
    // TKT - Tickets
    // ==========================================
    TKT_NOT_FOUND = 'TKT_001',
    TKT_ALREADY_CLOSED = 'TKT_002',
    TKT_SLA_BREACH = 'TKT_003',
    TKT_INVALID_STATUS_TRANSITION = 'TKT_004',
    TKT_ATTACHMENT_TOO_LARGE = 'TKT_005',
    TKT_ASSIGNEE_NOT_FOUND = 'TKT_006',
    TKT_DUPLICATE = 'TKT_007',
    TKT_LOCKED = 'TKT_008',

    // ==========================================
    // USR - Users
    // ==========================================
    USR_NOT_FOUND = 'USR_001',
    USR_EMAIL_EXISTS = 'USR_002',
    USR_INVALID_ROLE = 'USR_003',
    USR_CANNOT_DELETE_SELF = 'USR_004',
    USR_DEPARTMENT_REQUIRED = 'USR_005',
    USR_PRESET_NOT_FOUND = 'USR_006',

    // ==========================================
    // VAL - Validation
    // ==========================================
    VAL_MISSING_FIELD = 'VAL_001',
    VAL_INVALID_FORMAT = 'VAL_002',
    VAL_FIELD_TOO_LONG = 'VAL_003',
    VAL_FIELD_TOO_SHORT = 'VAL_004',
    VAL_INVALID_EMAIL = 'VAL_005',
    VAL_INVALID_DATE = 'VAL_006',
    VAL_INVALID_ID = 'VAL_007',

    // ==========================================
    // SYS - System
    // ==========================================
    SYS_INTERNAL_ERROR = 'SYS_001',
    SYS_DATABASE_ERROR = 'SYS_002',
    SYS_EXTERNAL_SERVICE_ERROR = 'SYS_003',
    SYS_CONFIGURATION_ERROR = 'SYS_004',
    SYS_FEATURE_DISABLED = 'SYS_005',
    SYS_MAINTENANCE_MODE = 'SYS_006',

    // ==========================================
    // ZOOM - Zoom Integration
    // ==========================================
    ZOOM_NOT_CONFIGURED = 'ZOOM_001',
    ZOOM_AUTH_FAILED = 'ZOOM_002',
    ZOOM_MEETING_NOT_FOUND = 'ZOOM_003',
    ZOOM_BOOKING_CONFLICT = 'ZOOM_004',
    ZOOM_SLOT_UNAVAILABLE = 'ZOOM_005',

    // ==========================================
    // KB - Knowledge Base
    // ==========================================
    KB_ARTICLE_NOT_FOUND = 'KB_001',
    KB_CATEGORY_NOT_FOUND = 'KB_002',
    KB_DUPLICATE_SLUG = 'KB_003',

    // ==========================================
    // NTF - Notifications
    // ==========================================
    NTF_NOT_FOUND = 'NTF_001',
    NTF_ALREADY_READ = 'NTF_002',
    NTF_DELIVERY_FAILED = 'NTF_003',

    // ==========================================
    // FILE - File Uploads
    // ==========================================
    FILE_TOO_LARGE = 'FILE_001',
    FILE_TYPE_NOT_ALLOWED = 'FILE_002',
    FILE_UPLOAD_FAILED = 'FILE_003',
    FILE_NOT_FOUND = 'FILE_004',

    // ==========================================
    // NET - Network
    // ==========================================
    NET_CONNECTION_FAILED = 'NET_001',
    NET_TIMEOUT = 'NET_002',
}

/**
 * Error code to HTTP status mapping
 */
export const ErrorCodeHttpStatus: Record<ErrorCode, number> = {
    // Auth - 401/403
    [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
    [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
    [ErrorCode.AUTH_TOKEN_INVALID]: 401,
    [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCode.AUTH_USER_DISABLED]: 403,
    [ErrorCode.AUTH_SESSION_EXPIRED]: 401,
    [ErrorCode.AUTH_MFA_REQUIRED]: 403,
    [ErrorCode.AUTH_PASSWORD_MISMATCH]: 400,
    [ErrorCode.AUTH_PASSWORD_TOO_WEAK]: 400,

    // CSRF - 403
    [ErrorCode.CSRF_TOKEN_MISSING]: 403,
    [ErrorCode.CSRF_TOKEN_INVALID]: 403,
    [ErrorCode.CSRF_TOKEN_EXPIRED]: 403,

    // Rate Limiting - 429
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.RATE_WS_CONNECTION_EXCEEDED]: 429,
    [ErrorCode.RATE_WS_MESSAGE_EXCEEDED]: 429,

    // Tickets - 400/404/409
    [ErrorCode.TKT_NOT_FOUND]: 404,
    [ErrorCode.TKT_ALREADY_CLOSED]: 409,
    [ErrorCode.TKT_SLA_BREACH]: 400,
    [ErrorCode.TKT_INVALID_STATUS_TRANSITION]: 400,
    [ErrorCode.TKT_ATTACHMENT_TOO_LARGE]: 400,
    [ErrorCode.TKT_ASSIGNEE_NOT_FOUND]: 400,
    [ErrorCode.TKT_DUPLICATE]: 409,
    [ErrorCode.TKT_LOCKED]: 423,

    // Users - 400/404/409
    [ErrorCode.USR_NOT_FOUND]: 404,
    [ErrorCode.USR_EMAIL_EXISTS]: 409,
    [ErrorCode.USR_INVALID_ROLE]: 400,
    [ErrorCode.USR_CANNOT_DELETE_SELF]: 400,
    [ErrorCode.USR_DEPARTMENT_REQUIRED]: 400,
    [ErrorCode.USR_PRESET_NOT_FOUND]: 404,

    // Validation - 400
    [ErrorCode.VAL_MISSING_FIELD]: 400,
    [ErrorCode.VAL_INVALID_FORMAT]: 400,
    [ErrorCode.VAL_FIELD_TOO_LONG]: 400,
    [ErrorCode.VAL_FIELD_TOO_SHORT]: 400,
    [ErrorCode.VAL_INVALID_EMAIL]: 400,
    [ErrorCode.VAL_INVALID_DATE]: 400,
    [ErrorCode.VAL_INVALID_ID]: 400,

    // System - 500/503
    [ErrorCode.SYS_INTERNAL_ERROR]: 500,
    [ErrorCode.SYS_DATABASE_ERROR]: 500,
    [ErrorCode.SYS_EXTERNAL_SERVICE_ERROR]: 502,
    [ErrorCode.SYS_CONFIGURATION_ERROR]: 500,
    [ErrorCode.SYS_FEATURE_DISABLED]: 503,
    [ErrorCode.SYS_MAINTENANCE_MODE]: 503,

    // Zoom - 400/404/409/502
    [ErrorCode.ZOOM_NOT_CONFIGURED]: 503,
    [ErrorCode.ZOOM_AUTH_FAILED]: 502,
    [ErrorCode.ZOOM_MEETING_NOT_FOUND]: 404,
    [ErrorCode.ZOOM_BOOKING_CONFLICT]: 409,
    [ErrorCode.ZOOM_SLOT_UNAVAILABLE]: 409,

    // Knowledge Base - 404/409
    [ErrorCode.KB_ARTICLE_NOT_FOUND]: 404,
    [ErrorCode.KB_CATEGORY_NOT_FOUND]: 404,
    [ErrorCode.KB_DUPLICATE_SLUG]: 409,

    // Notifications - 404
    [ErrorCode.NTF_NOT_FOUND]: 404,
    [ErrorCode.NTF_ALREADY_READ]: 409,
    [ErrorCode.NTF_DELIVERY_FAILED]: 500,

    // Files - 400/404/413
    [ErrorCode.FILE_TOO_LARGE]: 413,
    [ErrorCode.FILE_TYPE_NOT_ALLOWED]: 400,
    [ErrorCode.FILE_UPLOAD_FAILED]: 500,
    [ErrorCode.FILE_NOT_FOUND]: 404,

    // Network - 502/504
    [ErrorCode.NET_CONNECTION_FAILED]: 502,
    [ErrorCode.NET_TIMEOUT]: 504,
};
