import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { TraceCollectorService } from '../../../modules/health/services/trace-collector.service';
import { TraceClientInfo } from '../../../modules/health/dto/trace.dto';

@Injectable()
export class ApmTracingInterceptor implements NestInterceptor {
    constructor(private readonly traceCollector: TraceCollectorService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        if (context.getType() !== 'http') {
            return next.handle();
        }

        const http = context.switchToHttp();
        const req = http.getRequest<Request>();
        const res = http.getResponse<Response>();

        const path = req.path || req.url;

        // Skip internal telemetry & static noise to keep traces clean and high-value
        if (
            path.startsWith('/health/detailed') ||
            path.startsWith('/health/traces') ||
            path.startsWith('/health/live') ||
            path.startsWith('/health/ready') ||
            path.startsWith('/assets') ||
            path.startsWith('/favicon')
        ) {
            return next.handle();
        }

        const startHr = process.hrtime.bigint();
        const clientInfo = this.extractClientInfo(req);

        return next.handle().pipe(
            tap(() => {
                const endHr = process.hrtime.bigint();
                const durationMs = Math.max(1, Math.round(Number(endHr - startHr) / 1_000_000));
                const statusCode = res.statusCode || 200;

                this.traceCollector.recordTrace({
                    method: req.method,
                    path: req.baseUrl ? `${req.baseUrl}${req.path}` : path,
                    statusCode,
                    durationMs,
                    clientInfo,
                });
            }),
            catchError((err) => {
                const endHr = process.hrtime.bigint();
                const durationMs = Math.max(1, Math.round(Number(endHr - startHr) / 1_000_000));

                let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
                if (err instanceof HttpException) {
                    statusCode = err.getStatus();
                } else if (err?.status && typeof err.status === 'number') {
                    statusCode = err.status;
                }

                this.traceCollector.recordTrace({
                    method: req.method,
                    path: req.baseUrl ? `${req.baseUrl}${req.path}` : path,
                    statusCode,
                    durationMs,
                    clientInfo,
                    error: err,
                });

                return throwError(() => err);
            }),
        );
    }

    private extractClientInfo(req: Request): TraceClientInfo {
        const ua = req.headers['user-agent'] || 'Unknown Browser';
        const ip = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket?.remoteAddress || '127.0.0.1';

        // Extract simplified browser name
        let browser = 'Browser';
        if (ua.includes('Edg/')) browser = 'Edge';
        else if (ua.includes('Chrome/')) browser = 'Chrome';
        else if (ua.includes('Firefox/')) browser = 'Firefox';
        else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

        // Extract simplified OS
        let os = 'Windows';
        if (ua.includes('Windows')) os = 'Windows 11';
        else if (ua.includes('Macintosh')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

        return {
            app: 'idesk-web-client',
            browser,
            os,
            country: 'Indonesia',
            ip: ip.replace('::ffff:', ''),
        };
    }
}
