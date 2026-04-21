import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

/**
 * Logging Interceptor with Correlation ID and Slow Request Detection
 * 
 * Features:
 * - Logs all HTTP requests with correlation ID for tracing
 * - Detects and warns about slow requests exceeding threshold
 * - Logs errors with full context for debugging
 * - Skips non-HTTP contexts (WebSocket, Telegram, etc.)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    // Requests taking longer than this are logged as warnings
    private readonly SLOW_REQUEST_THRESHOLD_MS = 3000;

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        // Skip logging for non-HTTP contexts (like Telegram)
        if (context.getType() !== 'http') {
            return next.handle();
        }

        const req = context.switchToHttp().getRequest();
        if (!req || !req.method) {
            return next.handle();
        }

        const { method, url } = req;
        const correlationId = req.correlationId || 'no-correlation-id';
        const now = Date.now();

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - now;
                const userId = req.user?.userId || 'guest';
                const ip = req.ip || req.connection?.remoteAddress || 'unknown';

                const logData = {
                    correlationId,
                    method,
                    url: url.split('?')[0], // Remove query params for cleaner logs
                    userId,
                    ip,
                    durationMs: duration,
                };

                // Slow request detection
                if (duration > this.SLOW_REQUEST_THRESHOLD_MS) {
                    this.logger.warn({
                        ...logData,
                        message: 'SLOW_REQUEST',
                        threshold: this.SLOW_REQUEST_THRESHOLD_MS,
                    });
                } else {
                    this.logger.log(
                        `[${method}] ${url.split('?')[0]} - User: ${userId} - IP: ${ip} - ${duration}ms - CID: ${correlationId.slice(0, 8)}`,
                    );
                }
            }),
            catchError((error) => {
                const duration = Date.now() - now;
                const userId = req.user?.userId || 'guest';

                this.logger.error({
                    correlationId,
                    method,
                    url: url.split('?')[0],
                    userId,
                    durationMs: duration,
                    error: error.message,
                    statusCode: error.status || 500,
                });

                throw error;
            }),
        );
    }
}
