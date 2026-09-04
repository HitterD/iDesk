import { EndToEndTrace, ServiceNodeData } from './serviceMapTypes';
import { DetailedHealthStatus } from '../../hooks/useHealthSocket';

export const BASE_NODES: ServiceNodeData[] = [
    // 1. Client Tier
    {
        id: 'idesk-web-client',
        name: 'idesk-web-client',
        label: 'iDesk Web Portal',
        tier: 'client',
        statusCode: 200,
        execTimePercent: 44,
        latencyMs: 55,
        status: 'healthy',
        iconType: 'browser',
        description: 'React 19 SPA & Client Router',
    },

    // 2. Gateway Tier
    {
        id: 'api-gateway',
        name: 'api-gateway',
        label: 'API Gateway & Proxy',
        tier: 'gateway',
        statusCode: 200,
        execTimePercent: 12,
        latencyMs: 16,
        status: 'healthy',
        iconType: 'gateway',
        description: 'NestJS REST & Rate Limiter',
    },

    // 3. Core Services Tier
    {
        id: 'ticketing-engine',
        name: 'ticketing-engine',
        label: 'Ticketing Engine',
        tier: 'core',
        statusCode: 200,
        execTimePercent: 24,
        latencyMs: 33,
        status: 'healthy',
        iconType: 'tickets',
        description: 'SLA Engine & Auto-Assignment',
    },
    {
        id: 'auth-identity-svc',
        name: 'auth-identity-svc',
        label: 'Auth & Identity',
        tier: 'core',
        statusCode: 200,
        execTimePercent: 8,
        latencyMs: 12,
        status: 'healthy',
        iconType: 'auth',
        description: 'JWT Rotator & Argon2 Guard',
    },
    {
        id: 'zoom-booking-svc',
        name: 'zoom-booking-svc',
        label: 'Zoom Booking Service',
        tier: 'core',
        statusCode: 200,
        execTimePercent: 10,
        latencyMs: 15,
        status: 'healthy',
        iconType: 'video',
        description: 'Account Scheduler & Slots',
    },
    {
        id: 'notification-dispatcher',
        name: 'notification-dispatcher',
        label: 'Notification Center',
        tier: 'core',
        statusCode: 200,
        execTimePercent: 5,
        latencyMs: 8,
        status: 'healthy',
        iconType: 'bell',
        description: 'Event Router & Mail Formatter',
    },

    // 4. Storage & Message Brokers Tier
    {
        id: 'postgresql-primary',
        name: 'postgresql-primary',
        label: 'PostgreSQL 16 DB',
        tier: 'storage',
        statusCode: 200,
        execTimePercent: 10,
        latencyMs: 2,
        status: 'healthy',
        iconType: 'database',
        description: 'TypeORM Primary Connection Pool',
    },
    {
        id: 'redis-bull-queues',
        name: 'redis-bull-queues',
        label: 'Redis & BullMQ',
        tier: 'storage',
        statusCode: 200,
        execTimePercent: 4,
        latencyMs: 1,
        status: 'healthy',
        iconType: 'cache',
        description: 'Job Queues & Shared Session Cache',
    },
    {
        id: 'websocket-server',
        name: 'websocket-server',
        label: 'WebSocket Gateway',
        tier: 'storage',
        statusCode: 200,
        execTimePercent: 2,
        latencyMs: 1,
        status: 'healthy',
        iconType: 'socket',
        description: 'Socket.io TV Board & Health Room',
    },
    {
        id: 'synology-storage',
        name: 'synology-storage',
        label: 'Synology Drive S3',
        tier: 'storage',
        statusCode: 200,
        execTimePercent: 3,
        latencyMs: 12,
        status: 'healthy',
        iconType: 'storage',
        description: 'Automated Snapshots & File Uploads',
    },

    // 5. External Integrations Tier
    {
        id: 'smtp-mail-server',
        name: 'smtp-mail-server',
        label: 'SMTP Mail Server',
        tier: 'external',
        statusCode: 200,
        execTimePercent: 4,
        latencyMs: 22,
        status: 'healthy',
        iconType: 'mail',
        description: 'Corporate Mail Exchange Relay',
    },
    {
        id: 'telegram-bot-api',
        name: 'telegram-bot-api',
        label: 'Telegram Bot API',
        tier: 'external',
        statusCode: 200,
        execTimePercent: 3,
        latencyMs: 18,
        status: 'healthy',
        iconType: 'telegram',
        description: 'Ops Alert Dispatcher & Webhook',
    },
    {
        id: 'zoom-cloud-api',
        name: 'zoom-cloud-api',
        label: 'Zoom Cloud API',
        tier: 'external',
        statusCode: 200,
        execTimePercent: 8,
        latencyMs: 45,
        status: 'healthy',
        iconType: 'cloud',
        description: 'Zoom Video Communications REST',
    },
];

export const MOCK_TRACES: EndToEndTrace[] = [
    // Trace 1 [DEFAULT]: Live Production Traffic (100% HIJAU SEHAT - 200 OK)
    {
        traceId: '1092837461928472910',
        operationId: 'ok77aBldK8x=',
        operationName: 'POST /api/v1/tickets/create',
        httpMethod: 'POST',
        endpoint: 'https://idesk.santos.co.id/api/v1/tickets/create',
        totalDurationMs: 138,
        statusCode: 200,
        statusText: '200 OK',
        timestamp: 'Sep 03 22:46:01.442',
        clientInfo: {
            app: 'idesk-web-client',
            browser: 'Chrome 128.0',
            os: 'Windows 11 x64',
            country: 'Indonesia',
            ip: '192.168.10.112',
        },
        spanCount: 16,
        errorCount: 0,
        activeNodes: [
            'idesk-web-client',
            'api-gateway',
            'ticketing-engine',
            'postgresql-primary',
            'redis-bull-queues',
            'websocket-server',
            'smtp-mail-server',
            'telegram-bot-api',
        ],
        // Strict Forward Flow (Left to Right Only)
        connections: [
            { from: 'idesk-web-client', to: 'api-gateway', status: 'healthy' },
            { from: 'api-gateway', to: 'ticketing-engine', status: 'healthy' },
            { from: 'ticketing-engine', to: 'postgresql-primary', status: 'healthy' },
            { from: 'ticketing-engine', to: 'redis-bull-queues', status: 'healthy' },
            { from: 'ticketing-engine', to: 'websocket-server', status: 'healthy' },
            { from: 'redis-bull-queues', to: 'smtp-mail-server', status: 'healthy' },
            { from: 'redis-bull-queues', to: 'telegram-bot-api', status: 'healthy' },
        ],
        nodeMetrics: {
            'idesk-web-client': { statusCode: 200, execTimePercent: 40, latencyMs: 55, status: 'healthy' },
            'api-gateway': { statusCode: 200, execTimePercent: 12, latencyMs: 16, status: 'healthy' },
            'ticketing-engine': { statusCode: 200, execTimePercent: 24, latencyMs: 33, status: 'healthy' },
            'postgresql-primary': { statusCode: 200, execTimePercent: 10, latencyMs: 14, status: 'healthy' },
            'redis-bull-queues': { statusCode: 200, execTimePercent: 4, latencyMs: 5, status: 'healthy' },
            'websocket-server': { statusCode: 200, execTimePercent: 2, latencyMs: 3, status: 'healthy' },
            'smtp-mail-server': { statusCode: 200, execTimePercent: 4, latencyMs: 6, status: 'healthy' },
            'telegram-bot-api': { statusCode: 200, execTimePercent: 4, latencyMs: 6, status: 'healthy' },
        },
        events: [
            { id: '1', timestamp: '22:46:01.442', type: 'request', name: 'POST /api/v1/tickets/create', severity: 'Information', message: 'Payload parsed and validated against CreateTicketDto' },
            { id: '2', timestamp: '22:46:01.455', type: 'trace', name: 'JwtAuthGuard.canActivate', severity: 'Information', message: 'Session validated for client user@santos.co.id' },
            { id: '3', timestamp: '22:46:01.465', type: 'dependency', name: 'INSERT INTO "tickets"', severity: 'Information', message: 'Ticket record #TCK-2026-0895 persisted (siteId: site-A)' },
            { id: '4', timestamp: '22:46:01.478', type: 'dependency', name: 'BullMQ.add("notifications")', severity: 'Information', message: 'Enqueued notification job for ticket creators and assigned agents' },
            { id: '5', timestamp: '22:46:01.495', type: 'dependency', name: 'Socket.emit("tv-board:update")', severity: 'Information', message: 'Broadcasted real-time ticket creation event to site TV screens' },
            { id: '6', timestamp: '22:46:01.512', type: 'dependency', name: 'SMTP.sendMail()', severity: 'Information', message: 'Confirmation email queued and handed off to mail exchange' },
        ],
    },

    // Trace 2: User Authentication & Session Token Rotation (200 OK - Healthy)
    {
        traceId: '3319028471928374619',
        operationId: 'at88uJwtK3z=',
        operationName: 'POST /api/v1/auth/login',
        httpMethod: 'POST',
        endpoint: 'https://idesk.santos.co.id/api/v1/auth/login',
        totalDurationMs: 94,
        statusCode: 200,
        statusText: '200 OK',
        timestamp: 'Sep 03 22:47:19.082',
        clientInfo: {
            app: 'idesk-web-client',
            browser: 'Chrome 128.0',
            os: 'Windows 11 x64',
            country: 'Indonesia',
            ip: '192.168.10.22',
        },
        spanCount: 12,
        errorCount: 0,
        activeNodes: [
            'idesk-web-client',
            'api-gateway',
            'auth-identity-svc',
            'postgresql-primary',
            'redis-bull-queues',
        ],
        // Strict Forward Flow
        connections: [
            { from: 'idesk-web-client', to: 'api-gateway', status: 'healthy' },
            { from: 'api-gateway', to: 'auth-identity-svc', status: 'healthy' },
            { from: 'auth-identity-svc', to: 'postgresql-primary', status: 'healthy' },
            { from: 'auth-identity-svc', to: 'redis-bull-queues', status: 'healthy' },
        ],
        nodeMetrics: {
            'idesk-web-client': { statusCode: 200, execTimePercent: 44, latencyMs: 41, status: 'healthy' },
            'api-gateway': { statusCode: 200, execTimePercent: 15, latencyMs: 14, status: 'healthy' },
            'auth-identity-svc': { statusCode: 200, execTimePercent: 25, latencyMs: 24, status: 'healthy' },
            'postgresql-primary': { statusCode: 200, execTimePercent: 10, latencyMs: 9, status: 'healthy' },
            'redis-bull-queues': { statusCode: 200, execTimePercent: 6, latencyMs: 6, status: 'healthy' },
        },
        events: [
            { id: '1', timestamp: '22:47:19.082', type: 'request', name: 'POST /api/v1/auth/login', severity: 'Information', message: 'Credentials received for bagas.it@santos.co.id' },
            { id: '2', timestamp: '22:47:19.095', type: 'dependency', name: 'SELECT user FROM "users" WHERE email = $1', severity: 'Information', message: 'User found, active=true, site assigned' },
            { id: '3', timestamp: '22:47:19.140', type: 'trace', name: 'Argon2.verify', severity: 'Information', message: 'Password hash matched successfully' },
            { id: '4', timestamp: '22:47:19.162', type: 'dependency', name: 'Redis.setex(session_token)', severity: 'Information', message: 'Session persisted in Redis cache for 24 hours' },
        ],
    },

    // Trace 3 [SIMULASI ERROR 500]: Ticket Auto-Assignment DB Lock (Kasus Debugging)
    {
        traceId: '4490810889072308101',
        operationId: 't9e4hMtzDwk=',
        operationName: 'POST /api/v1/tickets/forward',
        httpMethod: 'POST',
        endpoint: 'https://idesk.santos.co.id/api/v1/tickets/forward',
        totalDurationMs: 1460,
        statusCode: 500,
        statusText: '500 INTERNAL SERVER ERROR',
        timestamp: 'Sep 03 22:45:12.363',
        clientInfo: {
            app: 'idesk-web-client',
            browser: 'Chrome 128.0',
            os: 'Windows 11 x64',
            country: 'Indonesia',
            ip: '192.168.10.45',
        },
        spanCount: 24,
        errorCount: 3,
        activeNodes: [
            'idesk-web-client',
            'api-gateway',
            'ticketing-engine',
            'postgresql-primary',
            'redis-bull-queues',
            'smtp-mail-server',
        ],
        // Strict Forward Flow (No backwards loop!)
        connections: [
            { from: 'idesk-web-client', to: 'api-gateway', status: 'error' },
            { from: 'api-gateway', to: 'ticketing-engine', status: 'error' },
            { from: 'ticketing-engine', to: 'postgresql-primary', status: 'error' },
            { from: 'ticketing-engine', to: 'redis-bull-queues', status: 'healthy' },
            { from: 'redis-bull-queues', to: 'smtp-mail-server', status: 'healthy' },
        ],
        nodeMetrics: {
            'idesk-web-client': { statusCode: 500, execTimePercent: 46, latencyMs: 672, status: 'error' },
            'api-gateway': { statusCode: 500, execTimePercent: 14, latencyMs: 204, status: 'error' },
            'ticketing-engine': { statusCode: 500, execTimePercent: 28, latencyMs: 408, status: 'error', errorBadge: '500 Error' },
            'postgresql-primary': { statusCode: 500, execTimePercent: 8, latencyMs: 116, status: 'error', errorBadge: 'Lock Timeout' },
            'redis-bull-queues': { statusCode: 200, execTimePercent: 2, latencyMs: 29, status: 'healthy' },
            'smtp-mail-server': { statusCode: 200, execTimePercent: 2, latencyMs: 31, status: 'healthy' },
        },
        events: [
            { id: '1', timestamp: '22:45:12.363', type: 'request', name: 'POST /api/v1/tickets/forward', severity: 'Information', message: 'Incoming ticket forward request received from client 192.168.10.45' },
            { id: '2', timestamp: '22:45:12.380', type: 'trace', name: 'JwtAuthGuard.canActivate', severity: 'Information', message: 'Bearer token validated for user agent-it18@santos.co.id' },
            { id: '3', timestamp: '22:45:12.415', type: 'trace', name: 'TicketForwardService.execute', severity: 'Information', message: 'Resolving destination handling team and target site agent pool' },
            { id: '4', timestamp: '22:45:12.480', type: 'dependency', name: 'SELECT ticket FROM "tickets" WHERE id = $1', severity: 'Information', message: 'Primary ticket entity fetched successfully (status: IN_PROGRESS)' },
            { id: '5', timestamp: '22:45:12.520', type: 'trace', name: 'OracleTicketAccessUtil.resolve', severity: 'Information', message: 'Routing determined: handlingTeam = ORACLE_DEV' },
            { id: '6', timestamp: '22:45:12.610', type: 'dependency', name: 'UPDATE "tickets" SET "status" = $1, "assigned_to_id" = $2', severity: 'Error', message: 'QueryFailedError: canceling statement due to lock timeout on relation tickets' },
            { id: '7', timestamp: '22:45:13.823', type: 'exception', name: 'TypeORM.QueryFailedError', severity: 'Error', message: 'Lock timeout detected while acquiring row-level exclusive lock on ticket #TCK-2026-0891', isException: true },
        ],
        exception: {
            type: 'QueryFailedError: LockTimeoutException',
            eventTime: '9/3/2026, 10:45:13.823 PM (Local time)',
            localTime: '22:45:13.823',
            message: 'canceling statement due to statement_timeout / lock_timeout: could not obtain lock on row in relation "tickets" after 1000ms. Concurrent transaction PID 33552 held conflicting row share lock.',
            failedMethod: 'TicketForwardService.autoAssignAgent (ticket-forward.service.ts:184)',
            customProperties: {
                azureAdClientId: 'd1a6053e-e04d-4704-9850-4848',
                applicationName: 'iDesk-Backend-Ticketing',
                identityName: 'bagas.it@santos.co.id',
                referer: 'https://idesk.santos.co.id/ticket-board',
                traceId: '4490810889072308101',
                operationId: 't9e4hMtzDwk=',
                clientIp: '192.168.10.45',
                endpoint: '/api/v1/tickets/forward',
                status: 500,
            },
            callStack: `QueryFailedError: canceling statement due to lock timeout
    at PostgresQueryRunner.query (f:\\Program Bagas\\SynologyDrive\\iDesk-main\\node_modules\\typeorm\\driver\\postgres\\PostgresQueryRunner.js:211:19)
    at async SelectQueryBuilder.executeEntitiesAndRawResults (f:\\Program Bagas\\SynologyDrive\\iDesk-main\\node_modules\\typeorm\\query-builder\\SelectQueryBuilder.js:342:26)
    at async TicketForwardService.autoAssignAgent (f:\\Program Bagas\\SynologyDrive\\iDesk-main\\apps\\backend\\src\\modules\\ticketing\\services\\ticket-forward.service.ts:184:13)
    at async TicketForwardController.forwardTicket (f:\\Program Bagas\\SynologyDrive\\iDesk-main\\apps\\backend\\src\\modules\\ticketing\\ticket-forward.controller.ts:42:20)
    at async f:\\Program Bagas\\SynologyDrive\\iDesk-main\\node_modules\\@nestjs\\core\\router\\router-execution-context.js:46:28`,
            relatedItems: [
                { title: 'Lihat query aktif PostgreSQL', description: 'Terdapat 2 transaksi paralel yang sedang mengunci baris tiket TCK-2026-0891' },
                { title: 'Telemetry 5 Menit Sebelum Kejadian', description: 'Koneksi database pool sempat berada pada 92% pemakaian saat proses forward' },
            ],
        },
    },

    // Trace 4 [SIMULASI ERROR 503]: Zoom Cloud Gateway Circuit Breaker
    {
        traceId: '8821903912049102834',
        operationId: 'zm91xPrtL9a=',
        operationName: 'POST /api/v1/zoom/book',
        httpMethod: 'POST',
        endpoint: 'https://idesk.santos.co.id/api/v1/zoom/book',
        totalDurationMs: 2310,
        statusCode: 503,
        statusText: '503 SERVICE UNAVAILABLE',
        timestamp: 'Sep 03 22:42:30.118',
        clientInfo: {
            app: 'idesk-web-client',
            browser: 'Edge 128.0',
            os: 'Windows 10 Pro',
            country: 'Indonesia',
            ip: '192.168.10.88',
        },
        spanCount: 18,
        errorCount: 2,
        activeNodes: [
            'idesk-web-client',
            'api-gateway',
            'zoom-booking-svc',
            'postgresql-primary',
            'zoom-cloud-api',
        ],
        // Strict Forward Flow
        connections: [
            { from: 'idesk-web-client', to: 'api-gateway', status: 'error' },
            { from: 'api-gateway', to: 'zoom-booking-svc', status: 'error' },
            { from: 'zoom-booking-svc', to: 'postgresql-primary', status: 'healthy' },
            { from: 'zoom-booking-svc', to: 'zoom-cloud-api', status: 'error' },
        ],
        nodeMetrics: {
            'idesk-web-client': { statusCode: 503, execTimePercent: 42, latencyMs: 970, status: 'error' },
            'api-gateway': { statusCode: 503, execTimePercent: 8, latencyMs: 185, status: 'error' },
            'zoom-booking-svc': { statusCode: 503, execTimePercent: 15, latencyMs: 346, status: 'error', errorBadge: 'Circuit Open' },
            'postgresql-primary': { statusCode: 200, execTimePercent: 2, latencyMs: 46, status: 'healthy' },
            'zoom-cloud-api': { statusCode: 504, execTimePercent: 33, latencyMs: 763, status: 'error', errorBadge: 'Gateway Timeout' },
        },
        events: [
            { id: '1', timestamp: '22:42:30.118', type: 'request', name: 'POST /api/v1/zoom/book', severity: 'Information', message: 'Client booking requested for Account Zoom #04' },
            { id: '2', timestamp: '22:42:30.145', type: 'dependency', name: 'SELECT account FROM "zoom_accounts"', severity: 'Information', message: 'Account status is ACTIVE and slot availability verified' },
            { id: '3', timestamp: '22:42:30.220', type: 'dependency', name: 'POST https://api.zoom.us/v2/users/me/meetings', severity: 'Error', message: 'AxiosError: timeout of 2000ms exceeded while connecting to Zoom Cloud API' },
            { id: '4', timestamp: '22:42:32.428', type: 'exception', name: 'ZoomCloudTimeoutException', severity: 'Error', message: 'External API Gateway Timeout: zoom.us unreachable from server subnet', isException: true },
        ],
        exception: {
            type: 'ZoomCloudTimeoutException: 503 Service Unavailable',
            eventTime: '9/3/2026, 10:42:32.428 PM (Local time)',
            localTime: '22:42:32.428',
            message: 'AxiosError: timeout of 2000ms exceeded while requesting meeting create on https://api.zoom.us/v2/users/me/meetings. Zoom API circuit breaker tripped to open state.',
            failedMethod: 'ZoomBookingService.createMeeting (zoom-booking.service.ts:412)',
            customProperties: {
                applicationName: 'iDesk-Zoom-Integration',
                identityName: 'marketing.user@santos.co.id',
                endpoint: '/api/v1/zoom/book',
                traceId: '8821903912049102834',
                status: 503,
            },
            callStack: `ZoomCloudTimeoutException: Zoom Cloud API Gateway Timeout
    at ZoomBookingService.createMeeting (f:\\Program Bagas\\SynologyDrive\\iDesk-main\\apps\\backend\\src\\modules\\zoom-booking\\services\\zoom-booking.service.ts:412:15)
    at async ZoomBookingController.bookSlot (f:\\Program Bagas\\SynologyDrive\\iDesk-main\\apps\\backend\\src\\modules\\zoom-booking\\zoom-booking.controller.ts:65:12)`,
        },
    },
];

export function syncNodesWithLiveHealth(
    nodes: ServiceNodeData[],
    health: DetailedHealthStatus | null | undefined,
    activeTrace: EndToEndTrace
): ServiceNodeData[] {
    return nodes.map((node) => {
        const traceMetric = activeTrace.nodeMetrics[node.id];
        const isActiveInTrace = activeTrace.activeNodes.includes(node.id);

        let liveLatency = node.latencyMs;
        let liveStatus = node.status;

        // Apply live telemetry overrides from useHealthSocket
        if (health) {
            if (node.id === 'postgresql-primary' && health.infrastructure?.database) {
                liveLatency = health.infrastructure.database.latency || liveLatency;
                if (health.infrastructure.database.status === 'disconnected') liveStatus = 'error';
            } else if (node.id === 'redis-bull-queues' && health.infrastructure?.redis) {
                liveLatency = health.infrastructure.redis.latency ?? liveLatency;
                if (health.infrastructure.redis.status === 'error') liveStatus = 'error';
                else if (health.infrastructure.redis.status === 'disabled') liveStatus = 'disabled';
            } else if (node.id === 'websocket-server' && health.infrastructure?.websocket) {
                if (health.infrastructure.websocket.status === 'inactive') liveStatus = 'error';
            } else if (node.id === 'synology-storage' && health.infrastructure?.backup) {
                if (!health.infrastructure.backup.configured) liveStatus = 'warning';
            }
        }

        // Apply active trace specific metrics
        if (traceMetric) {
            return {
                ...node,
                statusCode: traceMetric.statusCode,
                execTimePercent: traceMetric.execTimePercent,
                latencyMs: traceMetric.latencyMs,
                status: traceMetric.status,
                errorBadge: traceMetric.errorBadge,
            };
        }

        return {
            ...node,
            latencyMs: liveLatency,
            status: isActiveInTrace ? liveStatus : 'healthy',
        };
    });
}
