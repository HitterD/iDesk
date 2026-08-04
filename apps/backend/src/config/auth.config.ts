import { registerAs } from '@nestjs/config';

const PRODUCTION = 'production';
const MIN_JWT_SECRET_LENGTH = 32;

export interface AuthConfig {
    nodeEnv: string;
    jwtSecret: string;
    frontendUrl: string;
    wsCorsOrigin: string;
    encryptionKey?: string;
    dbSynchronize: boolean;
}

export function validateAuthEnvironment(env: NodeJS.ProcessEnv = process.env): AuthConfig {
    const nodeEnv = env.NODE_ENV || 'development';
    const jwtSecret = env.JWT_SECRET || '';
    const frontendUrl = env.FRONTEND_URL || '';
    const wsCorsOrigin = env.WS_CORS_ORIGIN || frontendUrl;
    const production = nodeEnv === PRODUCTION;
    const errors: string[] = [];

    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) errors.push('JWT_SECRET must be at least 32 characters');
    if (production && !env.DB_HOST) errors.push('DB_HOST is required in production');
    if (production && !env.DB_PASSWORD) errors.push('DB_PASSWORD is required in production');
    if (production && !env.DB_DATABASE) errors.push('DB_DATABASE is required in production');
    if (production && !frontendUrl) errors.push('FRONTEND_URL is required in production');
    if (production && !env.WS_CORS_ORIGIN) errors.push('WS_CORS_ORIGIN is required in production');
    if (production && env.REDIS_ENABLED === 'true' && !env.REDIS_PASSWORD) errors.push('REDIS_PASSWORD is required when Redis is enabled');
    if (production && !env.ENCRYPTION_KEY) errors.push('ENCRYPTION_KEY is required in production');
    if (env.DB_SYNCHRONIZE === 'true' && production) errors.push('DB_SYNCHRONIZE=true is forbidden in production');

    if (errors.length) throw new Error(`Invalid authentication environment: ${errors.join('; ')}`);

    return {
        nodeEnv,
        jwtSecret,
        frontendUrl,
        wsCorsOrigin,
        encryptionKey: env.ENCRYPTION_KEY,
        dbSynchronize: env.DB_SYNCHRONIZE === 'true' && !production,
    };
}

export default registerAs('auth', () => validateAuthEnvironment());
