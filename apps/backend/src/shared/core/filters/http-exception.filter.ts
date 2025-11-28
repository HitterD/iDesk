import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { appendFile } from 'fs/promises';

// In-memory buffer for batching log writes
const logBuffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 100;

async function flushLogBuffer() {
    if (logBuffer.length === 0) return;
    
    const logs = logBuffer.splice(0, logBuffer.length).join('');
    try {
        await appendFile('error.log', logs);
    } catch (err) {
        console.error('Failed to write to error.log:', err);
    }
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
        flushTimer = null;
        await flushLogBuffer();
    }, FLUSH_INTERVAL);
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

        const errorResponse = {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request?.url || 'unknown',
            message: typeof message === 'object' && 'message' in message ? (message as any).message : message,
        };

        this.logger.error(
            `HTTP Error: ${status} - ${JSON.stringify(errorResponse)}`,
            (exception as any).stack,
        );

        // Async buffered logging - non-blocking
        const logMessage = `${new Date().toISOString()} - HTTP Error: ${status} - ${JSON.stringify(errorResponse)}\nStack: ${(exception as any).stack}\n\n`;
        logBuffer.push(logMessage);
        
        // Flush immediately if buffer is full, otherwise schedule flush
        if (logBuffer.length >= MAX_BUFFER_SIZE) {
            flushLogBuffer();
        } else {
            scheduleFlush();
        }

        response.status(status).json(errorResponse);
    }
}
