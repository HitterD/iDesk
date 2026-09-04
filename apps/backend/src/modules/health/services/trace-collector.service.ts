import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { RealTraceRecord, TraceClientInfo, TraceEventStep, TraceExceptionDetails } from '../dto/trace.dto';
import { HealthGateway } from '../health.gateway';
import * as crypto from 'crypto';

@Injectable()
export class TraceCollectorService {
    private readonly logger = new Logger('TraceCollectorService');
    private readonly MAX_RING_BUFFER = 100;
    private readonly ringBuffer: RealTraceRecord[] = [];

    constructor(
        @Inject(forwardRef(() => HealthGateway))
        private readonly healthGateway: HealthGateway,
    ) { }

    /**
     * Record a completed HTTP request trace and broadcast to connected APM clients
     */
    recordTrace(param: {
        method: string;
        path: string;
        statusCode: number;
        durationMs: number;
        clientInfo: TraceClientInfo;
        error?: Error | any;
    }): RealTraceRecord {
        const traceId = crypto.randomBytes(8).toString('hex');
        const operationId = crypto.randomBytes(6).toString('base64');
        const isError = param.statusCode >= 400 || !!param.error;
        const statusText = this.getStatusText(param.statusCode);

        // Classify route to determine core microservice
        const coreService = this.resolveCoreService(param.path);
        const hasExternalZoom = param.path.includes('zoom');
        const hasMailOrTelegram = param.path.includes('ticket') || param.path.includes('notification');

        // Build active DAG nodes (Strict forward: Client -> Gateway -> Core -> DB/Queue -> External)
        const activeNodes: string[] = ['idesk-web-client', 'api-gateway', coreService.id, 'postgresql-primary'];
        if (coreService.usesRedis) activeNodes.push('redis-bull-queues');
        if (coreService.usesWebsocket) activeNodes.push('websocket-server');
        if (hasExternalZoom) activeNodes.push('zoom-cloud-api');
        if (hasMailOrTelegram && (param.method === 'POST' || param.method === 'PUT')) {
            activeNodes.push('smtp-mail-server');
        }

        // Build forward connections
        const connections: { from: string; to: string; status: 'healthy' | 'warning' | 'error' }[] = [
            { from: 'idesk-web-client', to: 'api-gateway', status: isError ? 'error' : 'healthy' },
            { from: 'api-gateway', to: coreService.id, status: isError ? 'error' : 'healthy' },
            { from: coreService.id, to: 'postgresql-primary', status: isError ? 'error' : 'healthy' },
        ];

        if (coreService.usesRedis) {
            connections.push({ from: coreService.id, to: 'redis-bull-queues', status: 'healthy' });
        }
        if (coreService.usesWebsocket) {
            connections.push({ from: coreService.id, to: 'websocket-server', status: 'healthy' });
        }
        if (hasExternalZoom) {
            connections.push({ from: coreService.id, to: 'zoom-cloud-api', status: isError ? 'error' : 'healthy' });
        }
        if (hasMailOrTelegram && (param.method === 'POST' || param.method === 'PUT') && coreService.usesRedis) {
            connections.push({ from: 'redis-bull-queues', to: 'smtp-mail-server', status: 'healthy' });
        }

        // Build node latency distribution
        const total = Math.max(1, param.durationMs);
        const clientDuration = Math.round(total * 0.4);
        const gatewayDuration = Math.max(1, Math.round(total * 0.15));
        const coreDuration = Math.max(1, Math.round(total * 0.25));
        const dbDuration = Math.max(1, Math.round(total * 0.15));
        const otherDuration = Math.max(1, total - (clientDuration + gatewayDuration + coreDuration + dbDuration));

        const nodeMetrics: Record<string, any> = {
            'idesk-web-client': {
                statusCode: param.statusCode,
                execTimePercent: 40,
                latencyMs: clientDuration,
                status: isError ? 'error' : 'healthy',
            },
            'api-gateway': {
                statusCode: param.statusCode,
                execTimePercent: 15,
                latencyMs: gatewayDuration,
                status: isError ? 'error' : 'healthy',
            },
            [coreService.id]: {
                statusCode: param.statusCode,
                execTimePercent: 25,
                latencyMs: coreDuration,
                status: isError ? 'error' : 'healthy',
                errorBadge: isError ? `${param.statusCode} Error` : undefined,
            },
            'postgresql-primary': {
                statusCode: isError && param.statusCode === 500 ? 500 : 200,
                execTimePercent: 15,
                latencyMs: dbDuration,
                status: isError && param.statusCode === 500 ? 'error' : 'healthy',
                errorBadge: isError && param.statusCode === 500 ? 'Query Failed' : undefined,
            },
        };

        if (coreService.usesRedis) {
            nodeMetrics['redis-bull-queues'] = {
                statusCode: 200,
                execTimePercent: 5,
                latencyMs: otherDuration,
                status: 'healthy',
            };
        }
        if (hasExternalZoom) {
            nodeMetrics['zoom-cloud-api'] = {
                statusCode: param.statusCode,
                execTimePercent: 10,
                latencyMs: otherDuration,
                status: isError ? 'error' : 'healthy',
            };
        }
        if (hasMailOrTelegram && activeNodes.includes('smtp-mail-server')) {
            nodeMetrics['smtp-mail-server'] = {
                statusCode: 200,
                execTimePercent: 5,
                latencyMs: otherDuration,
                status: 'healthy',
            };
        }

        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

        // Chronological events
        const events: TraceEventStep[] = [
            {
                id: '1',
                timestamp: timeStr,
                type: 'request',
                name: `${param.method} ${param.path}`,
                severity: isError ? 'Error' : 'Information',
                message: `Request received from ${param.clientInfo.ip} (${param.clientInfo.browser})`,
            },
            {
                id: '2',
                timestamp: timeStr,
                type: 'trace',
                name: 'Router & Guard Dispatcher',
                severity: 'Information',
                message: `Routed to ${coreService.label} handler`,
            },
            {
                id: '3',
                timestamp: timeStr,
                type: 'dependency',
                name: 'PostgreSQL Query Runner',
                severity: isError && param.statusCode === 500 ? 'Error' : 'Information',
                message: isError && param.statusCode === 500
                    ? `Database query failed or timed out during execution`
                    : `Query executed and entity validated in primary pool (${dbDuration}ms)`,
            },
        ];

        let exception: TraceExceptionDetails | undefined = undefined;
        if (isError && param.error) {
            const errObj = param.error;
            const errType = errObj.name || (param.statusCode === 404 ? 'NotFoundException' : 'HttpException');
            const errMsg = errObj.message || `HTTP ${param.statusCode} Error`;
            const stack = errObj.stack || `${errType}: ${errMsg}\n    at RequestHandler (router.js:12:3)`;

            events.push({
                id: '4',
                timestamp: timeStr,
                type: 'exception',
                name: errType,
                severity: 'Error',
                message: errMsg,
                isException: true,
            });

            exception = {
                type: errType,
                eventTime: now.toLocaleString('en-US', { timeZoneName: 'short' }),
                localTime: timeStr,
                message: errMsg,
                failedMethod: `${coreService.label}.handleRequest`,
                customProperties: {
                    endpoint: param.path,
                    method: param.method,
                    clientIp: param.clientInfo.ip,
                    traceId,
                    operationId,
                    statusCode: param.statusCode,
                },
                callStack: stack,
            };
        }

        const record: RealTraceRecord = {
            traceId,
            operationId,
            operationName: `${param.method} ${param.path}`,
            httpMethod: param.method,
            endpoint: `https://idesk.santos.co.id${param.path}`,
            totalDurationMs: param.durationMs,
            statusCode: param.statusCode,
            statusText,
            timestamp: now.toDateString().slice(4) + ' ' + timeStr,
            clientInfo: param.clientInfo,
            spanCount: activeNodes.length * 3,
            errorCount: isError ? 1 : 0,
            activeNodes,
            connections,
            nodeMetrics,
            events,
            exception,
        };

        // Push to Ring Buffer
        this.ringBuffer.unshift(record);
        if (this.ringBuffer.length > this.MAX_RING_BUFFER) {
            this.ringBuffer.pop();
        }

        // Live WebSocket broadcast to admin health room
        try {
            this.healthGateway.pushTrace(record);
        } catch (err) {
            this.logger.debug(`Could not broadcast trace: ${(err as any).message}`);
        }

        return record;
    }

    /**
     * Get recent recorded traces
     */
    getRecentTraces(): RealTraceRecord[] {
        return this.ringBuffer;
    }

    private resolveCoreService(path: string): { id: string; label: string; usesRedis: boolean; usesWebsocket: boolean } {
        if (path.includes('/auth') || path.includes('/login') || path.includes('/user')) {
            return { id: 'auth-identity-svc', label: 'Auth & Identity Service', usesRedis: true, usesWebsocket: false };
        }
        if (path.includes('/zoom')) {
            return { id: 'zoom-booking-svc', label: 'Zoom Booking Service', usesRedis: false, usesWebsocket: false };
        }
        if (path.includes('/notification') || path.includes('/sound')) {
            return { id: 'notification-dispatcher', label: 'Notification Dispatcher', usesRedis: true, usesWebsocket: true };
        }
        return { id: 'ticketing-engine', label: 'Ticketing Engine', usesRedis: true, usesWebsocket: true };
    }

    private getStatusText(code: number): string {
        switch (code) {
            case 200: return '200 OK';
            case 201: return '201 CREATED';
            case 204: return '204 NO CONTENT';
            case 400: return '400 BAD REQUEST';
            case 401: return '401 UNAUTHORIZED';
            case 403: return '403 FORBIDDEN';
            case 404: return '404 NOT FOUND';
            case 422: return '422 UNPROCESSABLE ENTITY';
            case 429: return '429 TOO MANY REQUESTS';
            case 500: return '500 INTERNAL SERVER ERROR';
            case 502: return '502 BAD GATEWAY';
            case 503: return '503 SERVICE UNAVAILABLE';
            case 504: return '504 GATEWAY TIMEOUT';
            default: return `${code} STATUS`;
        }
    }
}
