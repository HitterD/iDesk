import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        const errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message:
                typeof exceptionResponse === 'object' && 'message' in exceptionResponse
                    ? (exceptionResponse as any).message
                    : exception.message,
        };

        this.logger.error(
            `HTTP Error: ${status} - ${JSON.stringify(errorResponse)}`,
            exception.stack,
        );

        response.status(status).json(errorResponse);
    }
}
