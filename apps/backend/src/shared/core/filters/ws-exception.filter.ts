import {
    Catch,
    ArgumentsHost,
    Logger,
} from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket exception filter for Socket.IO.
 * Handles errors gracefully and sends structured error events to clients.
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
    private readonly logger = new Logger(WsExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const client = host.switchToWs().getClient<Socket>();
        const data = host.switchToWs().getData();

        // Extract error message
        let message = 'An error occurred';
        let code = 'WS_ERROR';

        if (exception instanceof WsException) {
            const error = exception.getError();
            message = typeof error === 'string' ? error : (error as any).message || message;
            code = (error as any).code || code;
        } else if (exception instanceof Error) {
            message = exception.message;

            // Don't expose internal error details in production
            if (process.env.NODE_ENV === 'production') {
                message = 'An internal error occurred';
            }
        }

        this.logger.error(
            `WebSocket Error [${client.id}]: ${message}`,
            exception instanceof Error ? exception.stack : undefined
        );

        // Emit error event to client
        client.emit('error', {
            code,
            message,
            timestamp: new Date().toISOString(),
            data: process.env.NODE_ENV !== 'production' ? data : undefined,
        });

        // Don't disconnect client on non-critical errors
        // Only disconnect on authentication failures
        if (code === 'UNAUTHORIZED' || code === 'AUTH_FAILED') {
            client.disconnect(true);
        }
    }
}

/**
 * Helper to create WebSocket exceptions with codes
 */
export class WsError extends WsException {
    constructor(message: string, public readonly code: string = 'WS_ERROR') {
        super({ message, code });
    }
}
