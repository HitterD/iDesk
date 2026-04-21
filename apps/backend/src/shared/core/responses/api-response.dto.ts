export class ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
        code: string;
        details?: any;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };

    static success<T>(data: T, message?: string): ApiResponse<T> {
        return { success: true, data, message };
    }

    static error(code: string, message: string, details?: any): ApiResponse {
        return { success: false, message, error: { code, details } };
    }

    static paginated<T>(
        data: T[],
        page: number,
        limit: number,
        total: number
    ): ApiResponse<T[]> {
        return {
            success: true,
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

export const ErrorCodes = {
    // Authentication & Authorization
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',

    // Resource Errors
    NOT_FOUND: 'NOT_FOUND',
    BAD_REQUEST: 'BAD_REQUEST',
    CONFLICT: 'CONFLICT',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',

    // Database Errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
    FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

    // File Errors
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',

    // Business Logic Errors
    SLA_BREACH: 'SLA_BREACH',
    TICKET_LOCKED: 'TICKET_LOCKED',
    TICKET_CLOSED: 'TICKET_CLOSED',
    CONTRACT_EXPIRED: 'CONTRACT_EXPIRED',

    // Rate Limiting & Server Errors
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // External Services
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
    PUSH_NOTIFICATION_FAILED: 'PUSH_NOTIFICATION_FAILED',

    // WebSocket
    WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
    WS_CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
