import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorCodeHttpStatus } from './error-codes.enum';

/**
 * BusinessException - Custom exception for business logic errors
 * 
 * Uses standardized error codes and provides consistent error responses.
 * 
 * Usage:
 * throw new BusinessException(ErrorCode.TKT_NOT_FOUND, 'Ticket with ID xxx not found');
 * throw new BusinessException(ErrorCode.USR_EMAIL_EXISTS);
 */
export class BusinessException extends HttpException {
    public readonly errorCode: ErrorCode;
    public readonly details?: Record<string, any>;
    public readonly timestamp: string;

    constructor(
        errorCode: ErrorCode,
        message?: string,
        details?: Record<string, any>,
    ) {
        const httpStatus = ErrorCodeHttpStatus[errorCode] || 500;
        const errorMessage = message || getDefaultMessage(errorCode);

        super(
            {
                statusCode: httpStatus,
                errorCode: errorCode,
                message: errorMessage,
                details: details,
                timestamp: new Date().toISOString(),
            },
            httpStatus,
        );

        this.errorCode = errorCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Default messages for error codes
 * These are fallback messages when no custom message is provided
 */
function getDefaultMessage(errorCode: ErrorCode): string {
    const defaultMessages: Record<ErrorCode, string> = {
        // Auth
        [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
        [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again',
        [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
        [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: 'You do not have permission to perform this action',
        [ErrorCode.AUTH_USER_DISABLED]: 'Your account has been disabled',
        [ErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired',
        [ErrorCode.AUTH_MFA_REQUIRED]: 'Multi-factor authentication is required',
        [ErrorCode.AUTH_PASSWORD_MISMATCH]: 'Current password is incorrect',
        [ErrorCode.AUTH_PASSWORD_TOO_WEAK]: 'Password does not meet security requirements',

        // CSRF
        [ErrorCode.CSRF_TOKEN_MISSING]: 'CSRF token is missing',
        [ErrorCode.CSRF_TOKEN_INVALID]: 'CSRF token is invalid',
        [ErrorCode.CSRF_TOKEN_EXPIRED]: 'CSRF token has expired',

        // Rate Limiting
        [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
        [ErrorCode.RATE_WS_CONNECTION_EXCEEDED]: 'Connection rate limit exceeded',
        [ErrorCode.RATE_WS_MESSAGE_EXCEEDED]: 'Message rate limit exceeded',

        // Tickets
        [ErrorCode.TKT_NOT_FOUND]: 'Ticket not found',
        [ErrorCode.TKT_ALREADY_CLOSED]: 'This ticket is already closed',
        [ErrorCode.TKT_SLA_BREACH]: 'SLA has been breached for this ticket',
        [ErrorCode.TKT_INVALID_STATUS_TRANSITION]: 'Invalid status transition',
        [ErrorCode.TKT_ATTACHMENT_TOO_LARGE]: 'Attachment file is too large',
        [ErrorCode.TKT_ASSIGNEE_NOT_FOUND]: 'Assignee not found',
        [ErrorCode.TKT_DUPLICATE]: 'A similar ticket already exists',
        [ErrorCode.TKT_LOCKED]: 'This ticket is locked for editing',

        // Users
        [ErrorCode.USR_NOT_FOUND]: 'User not found',
        [ErrorCode.USR_EMAIL_EXISTS]: 'An account with this email already exists',
        [ErrorCode.USR_INVALID_ROLE]: 'Invalid user role specified',
        [ErrorCode.USR_CANNOT_DELETE_SELF]: 'You cannot delete your own account',
        [ErrorCode.USR_DEPARTMENT_REQUIRED]: 'Department is required for this user role',
        [ErrorCode.USR_PRESET_NOT_FOUND]: 'Permission preset not found',

        // Validation
        [ErrorCode.VAL_MISSING_FIELD]: 'Required field is missing',
        [ErrorCode.VAL_INVALID_FORMAT]: 'Invalid data format',
        [ErrorCode.VAL_FIELD_TOO_LONG]: 'Field value exceeds maximum length',
        [ErrorCode.VAL_FIELD_TOO_SHORT]: 'Field value is too short',
        [ErrorCode.VAL_INVALID_EMAIL]: 'Invalid email format',
        [ErrorCode.VAL_INVALID_DATE]: 'Invalid date format',
        [ErrorCode.VAL_INVALID_ID]: 'Invalid ID format',

        // System
        [ErrorCode.SYS_INTERNAL_ERROR]: 'An internal error occurred',
        [ErrorCode.SYS_DATABASE_ERROR]: 'Database operation failed',
        [ErrorCode.SYS_EXTERNAL_SERVICE_ERROR]: 'External service is unavailable',
        [ErrorCode.SYS_CONFIGURATION_ERROR]: 'System configuration error',
        [ErrorCode.SYS_FEATURE_DISABLED]: 'This feature is currently disabled',
        [ErrorCode.SYS_MAINTENANCE_MODE]: 'System is under maintenance',

        // Zoom
        [ErrorCode.ZOOM_NOT_CONFIGURED]: 'Zoom integration is not configured',
        [ErrorCode.ZOOM_AUTH_FAILED]: 'Failed to authenticate with Zoom',
        [ErrorCode.ZOOM_MEETING_NOT_FOUND]: 'Zoom meeting not found',
        [ErrorCode.ZOOM_BOOKING_CONFLICT]: 'This time slot conflicts with another booking',
        [ErrorCode.ZOOM_SLOT_UNAVAILABLE]: 'This time slot is no longer available',

        // Knowledge Base
        [ErrorCode.KB_ARTICLE_NOT_FOUND]: 'Article not found',
        [ErrorCode.KB_CATEGORY_NOT_FOUND]: 'Category not found',
        [ErrorCode.KB_DUPLICATE_SLUG]: 'An article with this URL already exists',

        // Notifications
        [ErrorCode.NTF_NOT_FOUND]: 'Notification not found',
        [ErrorCode.NTF_ALREADY_READ]: 'Notification is already marked as read',
        [ErrorCode.NTF_DELIVERY_FAILED]: 'Failed to deliver notification',

        // Files
        [ErrorCode.FILE_TOO_LARGE]: 'File size exceeds the maximum limit',
        [ErrorCode.FILE_TYPE_NOT_ALLOWED]: 'This file type is not allowed',
        [ErrorCode.FILE_UPLOAD_FAILED]: 'Failed to upload file',
        [ErrorCode.FILE_NOT_FOUND]: 'File not found',

        // Network
        [ErrorCode.NET_CONNECTION_FAILED]: 'Connection to external service failed',
        [ErrorCode.NET_TIMEOUT]: 'Request timed out',
    };

    return defaultMessages[errorCode] || 'An error occurred';
}
