import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    BadRequestException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Formats class-validator validation errors into a more user-friendly structure.
 * Groups errors by field and provides clear messages.
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ValidationExceptionFilter.name);

    catch(exception: BadRequestException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse() as any;

        // Check if this is a validation error from class-validator
        if (exceptionResponse?.message && Array.isArray(exceptionResponse.message)) {
            const validationErrors = this.formatValidationErrors(exceptionResponse.message);

            this.logger.debug(
                `Validation failed: ${JSON.stringify(validationErrors.errors)}`
            );

            return response.status(status).json({
                statusCode: status,
                error: 'Validation Error',
                message: validationErrors.summary,
                errors: validationErrors.errors,
                timestamp: new Date().toISOString(),
            });
        }

        // Not a validation error, pass through original response
        return response.status(status).json({
            statusCode: status,
            message: exceptionResponse?.message || 'Bad Request',
            error: exceptionResponse?.error || 'Bad Request',
            timestamp: new Date().toISOString(),
        });
    }

    private formatValidationErrors(messages: string[]): {
        summary: string;
        errors: Record<string, string[]>;
    } {
        const errors: Record<string, string[]> = {};

        // Parse validation messages and group by field
        messages.forEach((message) => {
            // Common patterns: "field must be...", "field should be..."
            const fieldMatch = message.match(/^(\w+)\s/);
            const field = fieldMatch ? fieldMatch[1] : 'general';

            if (!errors[field]) {
                errors[field] = [];
            }
            errors[field].push(message);
        });

        // Generate summary
        const fieldCount = Object.keys(errors).length;
        const summary = fieldCount === 1
            ? `Validation failed for ${Object.keys(errors)[0]}`
            : `Validation failed for ${fieldCount} fields`;

        return { summary, errors };
    }
}
