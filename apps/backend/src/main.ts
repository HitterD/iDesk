import 'dotenv/config'; // Load .env first
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './shared/core/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { LoggingInterceptor } from './shared/core/interceptors/logging.interceptor';
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

    process.env.TZ = 'UTC';
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.enableCors({
        origin: ['http://localhost:4050', 'http://localhost:5173', 'http://localhost:3000'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

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

    app.useGlobalFilters(new HttpExceptionFilter());
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

    // Enable Gzip compression
    app.use(compression());

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

    await app.listen(5050);
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
