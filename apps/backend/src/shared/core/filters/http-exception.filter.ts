import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Business fields of an object-bodied 4xx that clients may branch on (e.g. the
 * takeover 409 `{ code, currentAssignee }` / bulk `{ code, tickets }`). Explicit
 * allow-list so other bodies (login `errorCode`, renewal `existingId`) stay
 * unforwarded. 5xx bodies are never forwarded.
 */
const FORWARDED_BODY_KEYS = ['code', 'currentAssignee', 'tickets', 'overlap'] as const;

function businessFields(body: unknown, status: number): Record<string, unknown> {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR || !body || typeof body !== 'object') return {};
    return Object.fromEntries(
        Object.entries(body).filter(([key]) => (FORWARDED_BODY_KEYS as readonly string[]).includes(key)),
    );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        // Only handle HTTP context
        if (host.getType() !== 'http') {
            this.logger.error(
                `Non-HTTP Error: ${(exception as any).message}`,
                (exception as any).stack,
            );
            return;
        }

        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Check if response object is valid
        if (!response || typeof response.status !== 'function') {
            this.logger.error(
                `Invalid response object: ${(exception as any).message}`,
                (exception as any).stack,
            );
            return;
        }

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : (exception as any).message || 'Internal server error';

        const isProduction = process.env.NODE_ENV === 'production';

        // Extract the actual message
        const actualMessage = typeof message === 'object' && 'message' in message
            ? (message as any).message
            : message;

        // In production, hide internal error details for 500 errors
        const safeMessage = isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Internal server error'
            : actualMessage;

        const errorResponse = {
            ...businessFields(message, status),
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request?.url || 'unknown',
            message: safeMessage,
            // Only include error details in development
            ...((!isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) && {
                error: (exception as any).message,
            }),
        };

        this.logger.error(
            `HTTP Error: ${status} - ${JSON.stringify(errorResponse)}`,
            (exception as any).stack,
        );

        response.status(status).json(errorResponse);
    }
}
