import { registerAs } from '@nestjs/config';

const PRODUCTION = 'production';
const MIN_JWT_SECRET_LENGTH = 32;

export interface AuthConfig {
    nodeEnv: string;
    jwtSecret: string;
    frontendUrl: string;
    wsCorsOrigin: string;
    encryptionKey?: string;
    dbHost: string;
    dbUsername: string;
    dbPassword: string;
    dbDatabase: string;
    dbPort: number;
    dbSynchronize: boolean;
}

export function validateAuthEnvironment(env: NodeJS.ProcessEnv = process.env): AuthConfig {
    const nodeEnv = env.NODE_ENV || 'development';
    const jwtSecret = env.JWT_SECRET || '';
    const frontendUrl = env.FRONTEND_URL || '';
    const wsCorsOrigin = env.WS_CORS_ORIGIN || frontendUrl;
    const dbHost = env.DB_HOST || '';
    const dbUsername = env.DB_USERNAME || '';
    const dbPassword = env.DB_PASSWORD || '';
    const dbDatabase = env.DB_DATABASE || '';
    const dbPort = Number(env.DB_PORT || 5432);
    const production = nodeEnv === PRODUCTION;
    const errors: string[] = [];

    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) errors.push('JWT_SECRET must be at least 32 characters');
    if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) errors.push('DB_PORT must be a valid port');
    if (production && !dbHost) errors.push('DB_HOST is required in production');
    if (production && !dbUsername) errors.push('DB_USERNAME is required in production');
    if (production && !dbPassword) errors.push('DB_PASSWORD is required in production');
    if (production && !dbDatabase) errors.push('DB_DATABASE is required in production');
    if (production && !frontendUrl) errors.push('FRONTEND_URL is required in production');
    if (production && !env.WS_CORS_ORIGIN) errors.push('WS_CORS_ORIGIN is required in production');
    if (production && env.REDIS_ENABLED === 'true' && !env.REDIS_PASSWORD) errors.push('REDIS_PASSWORD is required when Redis is enabled');
    if (production && (!env.ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY))) errors.push('ENCRYPTION_KEY must be a 32-byte hex key in production');
    if (production && (!env.EFORM_ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(env.EFORM_ENCRYPTION_KEY))) errors.push('EFORM_ENCRYPTION_KEY must be a 32-byte hex key in production');
    if (production && env.TELEGRAM_USE_WEBHOOK === 'true' && !env.TELEGRAM_WEBHOOK_SECRET) errors.push('TELEGRAM_WEBHOOK_SECRET is required when Telegram webhook is enabled');
    if (env.DB_SYNCHRONIZE === 'true' && production) errors.push('DB_SYNCHRONIZE=true is forbidden in production');

    if (errors.length) throw new Error(`Invalid authentication environment: ${errors.join('; ')}`);

    return {
        nodeEnv,
        jwtSecret,
        frontendUrl,
        wsCorsOrigin,
        encryptionKey: env.ENCRYPTION_KEY,
        dbHost,
        dbUsername,
        dbPassword,
        dbDatabase,
        dbPort,
        dbSynchronize: env.DB_SYNCHRONIZE === 'true' && !production,
    };
}

export default registerAs('auth', () => validateAuthEnvironment());
