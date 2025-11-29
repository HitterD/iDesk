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
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    BAD_REQUEST: 'BAD_REQUEST',
    CONFLICT: 'CONFLICT',
    RATE_LIMITED: 'RATE_LIMITED',
} as const;
