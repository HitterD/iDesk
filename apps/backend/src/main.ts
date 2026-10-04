import 'dotenv/config'; // Load .env first

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { HttpExceptionFilter } from './shared/core/filters/http-exception.filter';
import { ValidationExceptionFilter } from './shared/core/filters/validation-exception.filter';
import { DatabaseExceptionFilter } from './shared/core/filters/database-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { LoggingInterceptor } from './shared/core/interceptors/logging.interceptor';
import { CorrelationMiddleware } from './shared/core/middleware/correlation.middleware';
// import { CsrfMiddleware } from './shared/core/middleware/csrf.middleware'; // Disabled - SameSite cookies provide CSRF protection
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';
import { validateAuthEnvironment } from './config/auth.config';
import { createUploadsFileHandler } from './modules/ticketing/presentation/middleware/uploads-file.handler';
import { TicketAttachmentAccessService } from './modules/ticketing/services/ticket-attachment-access.service';

function validateEnvironment(): void {
    validateAuthEnvironment(process.env);
}

/** 5 attachments x 10 MB, base64-encoded (+33%), plus the ticket fields. */
const IPOP_JSON_LIMIT = '70mb';

async function bootstrap() {
    validateEnvironment();
    const logger = new Logger('Bootstrap');

    process.env.TZ = 'UTC';
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Express 5 changed the default "query parser" from 'extended' (qs) to
    // 'simple' (node:querystring). 'simple' does not understand bracket
    // notation, so axios' default array serialization `status[]=A&status[]=B`
    // arrives as the literal key "status[]" instead of an array. The global
    // ValidationPipe below (forbidNonWhitelisted) then rejects it with 400.
    // Restoring 'extended' keeps array query params working across all routes.
    app.set('query parser', 'extended');

    // Trust proxy: allow Express to trust upstream reverse proxies (Nginx, Synology NAS, Docker network)
    // to correctly extract client IP from X-Forwarded-* headers and req.ip
    app.set('trust proxy', true);

    // Enable API Versioning for backward compatibility
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    const isProd = process.env.NODE_ENV === 'production';
    const allowedOrigins = isProd ? [] : [
        'http://localhost:4050',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://idesk.santos.co.id',
        'https://idesk.santos.co.id',
        'http://idesk.santos.co.id:4050',
    ];
    if (process.env.FRONTEND_URL) {
        const extraOrigins = process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean);
        allowedOrigins.push(...extraOrigins);
    }
    if (isProd && allowedOrigins.length === 0) {
        logger.warn('CORS: no FRONTEND_URL set in production — browser requests will be blocked');
    }
    
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const isAllowed = allowedOrigins.includes(origin) ||
                /^https?:\/\/([a-zA-Z0-9-]+\.)*santos\.co\.id(:[0-9]+)?$/.test(origin) ||
                /^https?:\/\/localhost(:[0-9]+)?$/.test(origin) ||
                /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/.test(origin) ||
                /^https?:\/\/192\.168\.[0-9]+\.[0-9]+(:[0-9]+)?$/.test(origin) ||
                /^https?:\/\/10\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?$/.test(origin) ||
                /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+(:[0-9]+)?$/.test(origin);
            if (isAllowed) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked for origin: ${origin}`), false);
            }
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Security Headers - Must be early in the middleware chain to cover all paths
    // (P0 fix: was registered after CorrelationMiddleware/LoggingInterceptor/deprecation shim,
    // meaning 404s and any early-terminated requests leaked without helmet headers)
    app.use(helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
                connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'https://*.sentry.io'],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
            },
        } : false,
        hsts: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true' ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        } : false,
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));

    // iPop integration: keep the exact request bytes for the HMAC check, and allow the
    // base64 attachments it sends inline (registered first so the global parser skips it).
    // Both prefixes: the /api -> /v1 rewrite below runs after this parser.
    app.use(['/v1/integrations/ipop', '/api/v1/integrations/ipop'], express.json({
        limit: IPOP_JSON_LIMIT,
        verify: (req: any, _res, buf) => { req.rawBody = Buffer.from(buf); },
    }));

    // Body size limits - DoS protection (P0: defaults allow 100KB JSON, unlimited urlencoded)
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ limit: '1mb', extended: true }));

    // Cookie parser for HttpOnly cookie auth
    app.use(cookieParser());

    // CSRF Protection: DISABLED
    // --------------------------
    // SameSite:strict cookies (used in auth.controller.ts) already provide CSRF protection.
    // Cross-origin requests cannot include the auth cookie, preventing CSRF attacks.
    // This follows OWASP guidelines: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#samesite-cookie-attribute
    // 
    // All authenticated routes are also protected by JwtAuthGuard + RolesGuard.
    // The custom CSRF middleware was causing issues with path matching and is redundant.
    // 
    // If you need to re-enable CSRF, ensure:
    // 1. All controller paths are correctly listed in exemptPaths
    // 2. The middleware is bound correctly: csrfMiddleware.use.bind(csrfMiddleware)
    // const csrfMiddleware = new CsrfMiddleware();
    // app.use(csrfMiddleware.use.bind(csrfMiddleware));

    // Ensure uploads directories exist
    const fs = require('fs');
    const uploadDirs = [
        './uploads',
        './uploads/kb',
        './uploads/avatars',
        './uploads/contracts',
        './uploads/documents',
        './uploads/temp',
        './uploads/sounds',
    ];
    uploadDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Serve static files from uploads directory with fallback resolution for subfolders
    const uploadRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

    // Ticket chat attachments are checked against ticket access before anything is served;
    // the static middlewares below only ever see non-ticket files.
    app.use('/uploads', createUploadsFileHandler(uploadRoot, app.get(TicketAttachmentAccessService)));

    app.useStaticAssets(uploadRoot, {
        prefix: '/uploads/',
    });

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));

    // Register exception filters (order matters - more specific first)
    app.useGlobalFilters(
        new HttpExceptionFilter(),        // Catch-all for HTTP exceptions
        new ValidationExceptionFilter(),  // Format validation errors
        new DatabaseExceptionFilter(),    // Handle TypeORM errors
    );

    // Apply correlation ID middleware for request tracing
    app.use(new CorrelationMiddleware().use);

    app.useGlobalInterceptors(new LoggingInterceptor());

    // URL compatibility middleware: strip /api prefix from /api/v1/ endpoints
    // so clients or webhooks configured with either /api/v1/ or /v1/ reach Nest controllers seamlessly
    app.use((req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/v1/')) {
            req.url = req.url.replace(/^\/api/, '');
        }
        next();
    });

    // SJA Notification Proxy: forward /v1/devices/activation/* and /v1/devices/auth/* to SJA Backend
    app.use(async (req: any, res: any, next: any) => {
        // Endpoint SJA devices proxy (termasuk verifikasi sesi aktivasi berotentikasi)
        const path = req.path || '';
        if (path.startsWith('/v1/devices/activation/approve')) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                error: 'Forbidden',
                message: 'Endpoint aktivasi perangkat tanpa otentikasi telah dinonaktifkan. Gunakan /v1/notifications/devices/activation/approve dengan sesi login iDesk.',
            });
        }
        if (path.startsWith('/v1/devices/activation/') || path.startsWith('/v1/devices/auth/') || path === '/v1/devices') {
            const rawSjaUrl = process.env.SJA_BACKEND_URL || process.env.SJA_SERVER_URL || 'http://127.0.0.1:18302';
            const sjaUrl = rawSjaUrl.replace(/\/$/, '');
            try {
                const targetUrl = `${sjaUrl.replace(/\/$/, '')}${req.url}`;
                const fetchOptions: any = {
                    method: req.method,
                    headers: { 'Content-Type': 'application/json' },
                };
                if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
                    fetchOptions.body = JSON.stringify(req.body);
                }
                const proxyResp = await fetch(targetUrl, fetchOptions);
                const data = await proxyResp.json();
                return res.status(proxyResp.status).json(data);
            } catch (err: any) {
                return res.status(502).json({
                    success: false,
                    error: `SJA Backend proxy error: ${err.message}`,
                });
            }
        }
        next();
    });

    // Deprecation shim: ict-budget module replaced by hardware-requests
    app.use((req: any, res: any, next: any) => {
        if (req.path.startsWith('/api/ict-budget')) {
            return res.status(410).json({
                success: false,
                error: 'This module has been replaced by /api/hardware-requests',
            });
        }
        next();
    });

    // Security Headers - Configuration moved to top of bootstrap (see above)
    // (P0 fix: helmet must run before correlation/logging/deprecation shim middleware
    // so headers cover all response paths including 404s)

    // Enable Gzip compression with optimized settings
    app.use(compression({
        filter: (req: any, res: any) => {
            // Skip compression if client requests it
            if (req.headers['x-no-compression']) {
                return false;
            }
            // Use default filter for compression eligibility
            return compression.filter(req, res);
        },
        level: 6,          // Balanced compression (1-9, 6 is default)
        threshold: 1024,   // Only compress responses > 1KB
        memLevel: 8,       // Memory level for compression (1-9)
    }));

    // Swagger Documentation
    const config = new DocumentBuilder()
        .setTitle('iDesk API')
        .setDescription('The iDesk Helpdesk API documentation.')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('Auth', 'Authentication endpoints')
        .addTag('Tickets', 'Ticket management endpoints')
        .addTag('Users', 'User management endpoints')
        .addTag('Uploads', 'File upload endpoints')
        .addTag('Notifications', 'Notification endpoints')
        .addTag('Reports', 'Reporting endpoints')
        .addTag('Knowledge Base', 'Knowledge base articles')
        .addTag('Renewal Contracts', 'Contract renewal management')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Start server and configure timeouts
    const port = Number(process.env.PORT || 5050);
    const server = await app.listen(port, '0.0.0.0');

    // Server timeout configuration to prevent resource exhaustion
    server.setTimeout(30000);         // 30 second request timeout
    server.keepAliveTimeout = 65000;  // Slightly higher than ALB's 60s default
    server.headersTimeout = 66000;    // Slightly higher than keepAliveTimeout

    const url = await app.getUrl();
    logger.log(`🚀 Application is running on: ${url}`);
    logger.log(`📚 API Documentation: ${url}/api/docs`);
    logger.log(`⏱️  Server timeout: 30s, Keep-alive: 65s`);
}

bootstrap();
