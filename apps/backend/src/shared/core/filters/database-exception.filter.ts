import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';

/**
 * Database exception filter for TypeORM errors.
 * Transforms database errors into appropriate HTTP responses.
 */
@Catch(QueryFailedError, EntityNotFoundError)
export class DatabaseExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(DatabaseExceptionFilter.name);

    catch(exception: QueryFailedError | EntityNotFoundError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const isProduction = process.env.NODE_ENV === 'production';
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Database error occurred';
        let code = 'DATABASE_ERROR';

        if (exception instanceof EntityNotFoundError) {
            status = HttpStatus.NOT_FOUND;
            message = 'The requested resource was not found';
            code = 'NOT_FOUND';
        } else if (exception instanceof QueryFailedError) {
            const error = exception as any;
            const driverError = error.driverError || error;

            // PostgreSQL error codes
            switch (driverError.code) {
                // Unique constraint violation
                case '23505':
                    status = HttpStatus.CONFLICT;
                    message = this.extractUniqueViolationMessage(driverError.detail);
                    code = 'DUPLICATE_ENTRY';
                    break;

                // Foreign key violation
                case '23503':
                    status = HttpStatus.BAD_REQUEST;
                    message = 'Cannot perform this action due to related records';
                    code = 'FOREIGN_KEY_VIOLATION';
                    break;

                // Not null violation
                case '23502':
                    status = HttpStatus.BAD_REQUEST;
                    const columnName = driverError.column || this.extractColumnFromDetail(driverError.detail);
                    message = columnName
                        ? `Required field is missing: ${columnName}`
                        : 'Required field is missing';
                    code = 'MISSING_REQUIRED_FIELD';
                    // Log full error for debugging
                    this.logger.error(`NOT NULL violation on column: ${columnName}`, {
                        table: driverError.table,
                        column: driverError.column,
                        detail: driverError.detail,
                    });
                    break;

                // Check constraint violation
                case '23514':
                    status = HttpStatus.BAD_REQUEST;
                    message = 'Invalid data provided';
                    code = 'CHECK_CONSTRAINT_VIOLATION';
                    break;

                // Connection error
                case 'ECONNREFUSED':
                case '08006':
                case '08001':
                    status = HttpStatus.SERVICE_UNAVAILABLE;
                    message = 'Service temporarily unavailable';
                    code = 'DATABASE_UNAVAILABLE';
                    break;

                // Deadlock
                case '40P01':
                    status = HttpStatus.CONFLICT;
                    message = 'Please try again';
                    code = 'DEADLOCK';
                    break;

                default:
                    // Log unknown errors for investigation
                    this.logger.error(
                        `Unknown database error code: ${driverError.code}`,
                        exception.stack
                    );
            }
        }

        // Always log the full error for debugging
        this.logger.error(`Database Error: ${exception.message}`, exception.stack);

        const errorResponse = {
            statusCode: status,
            code,
            message,
            path: request.url,
            timestamp: new Date().toISOString(),
            // Include error details only in development
            ...((!isProduction) && {
                detail: exception.message,
            }),
        };

        response.status(status).json(errorResponse);
    }

    /**
     * Extract meaningful message from PostgreSQL unique violation detail
     */
    private extractUniqueViolationMessage(detail?: string): string {
        if (!detail) return 'A record with this value already exists';

        // Pattern: Key (column_name)=(value) already exists
        const match = detail.match(/Key \((\w+)\)=\((.+)\) already exists/);
        if (match) {
            const [, fieldName, value] = match;
            const readableField = this.toReadableFieldName(fieldName);
            return `${readableField} "${value}" already exists`;
        }

        return 'A record with this value already exists';
    }

    /**
     * Convert snake_case field name to readable format
     */
    private toReadableFieldName(fieldName: string): string {
        return fieldName
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Extract column name from PostgreSQL NOT NULL violation detail
     */
    private extractColumnFromDetail(detail?: string): string | undefined {
        if (!detail) return undefined;
        // Pattern: column "column_name" violates not-null constraint
        const match = detail.match(/column "(\w+)"/);
        return match ? match[1] : undefined;
    }
}
