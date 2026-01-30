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

// Environment validation - fail fast if critical vars are missing
function validateEnvironment() {
    const logger = new Logger('Bootstrap');
    const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_PASSWORD', 'DB_DATABASE'];
    const missingVars: string[] = [];

    requiredEnvVars.forEach(envVar => {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    });

    if (missingVars.length > 0) {
        logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
        logger.error('Please check your .env file and ensure all required variables are set.');
        process.exit(1);
    }

    logger.log('Environment validation passed ✓');
}

async function bootstrap() {
    validateEnvironment();
    const logger = new Logger('Bootstrap');

    process.env.TZ = 'UTC';
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Enable API Versioning for backward compatibility
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    app.enableCors({
        origin: ['http://localhost:4050', 'http://localhost:5173', 'http://localhost:3000'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

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
        './uploads/telegram',
        './uploads/avatars',
        './uploads/contracts',
        './uploads/documents',
        './uploads/temp',
    ];
    uploadDirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Serve static files from uploads directory
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
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

    // Security Headers - Enhanced Configuration (Section 5.5.B)
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
        hsts: process.env.NODE_ENV === 'production' ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        } : false,
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));

    // Enable Gzip compression with optimized settings
    app.use(compression({
        filter: (req, res) => {
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
    const server = await app.listen(5050);

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
