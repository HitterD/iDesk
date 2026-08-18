import { validateAuthEnvironment } from './auth.config';

describe('validateAuthEnvironment', () => {
    const base = {
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        DB_HOST: 'postgres',
        DB_USERNAME: 'idesk',
        DB_PASSWORD: 'db-secret',
        DB_DATABASE: 'idesk',
        FRONTEND_URL: 'https://app.example.com',
        WS_CORS_ORIGIN: 'https://app.example.com',
        ENCRYPTION_KEY: 'a'.repeat(64),
        EFORM_ENCRYPTION_KEY: 'b'.repeat(64),
        REDIS_ENABLED: 'true',
        REDIS_PASSWORD: 'redis-secret',
    };

    it('accepts complete production configuration', () => {
        expect(validateAuthEnvironment(base).dbSynchronize).toBe(false);
    });

    it('rejects short JWT secret', () => {
        expect(() => validateAuthEnvironment({ ...base, JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
    });

    it('rejects missing production WebSocket origin', () => {
        const env: NodeJS.ProcessEnv = { ...base };
        delete env.WS_CORS_ORIGIN;
        expect(() => validateAuthEnvironment(env)).toThrow('WS_CORS_ORIGIN');
    });

    it('rejects production schema synchronization', () => {
        expect(() => validateAuthEnvironment({ ...base, DB_SYNCHRONIZE: 'true' })).toThrow('DB_SYNCHRONIZE');
    });

    it('rejects missing production database username', () => {
        const env: NodeJS.ProcessEnv = { ...base };
        delete env.DB_USERNAME;
        expect(() => validateAuthEnvironment(env)).toThrow('DB_USERNAME');
    });

    it('rejects non-hex encryption keys', () => {
        expect(() => validateAuthEnvironment({ ...base, ENCRYPTION_KEY: 'x'.repeat(64) })).toThrow('ENCRYPTION_KEY');
    });

    it('rejects missing production EForm encryption key', () => {
        const env: NodeJS.ProcessEnv = { ...base };
        delete env.EFORM_ENCRYPTION_KEY;
        expect(() => validateAuthEnvironment(env)).toThrow('EFORM_ENCRYPTION_KEY');
    });

    it('rejects non-hex EForm encryption key', () => {
        expect(() => validateAuthEnvironment({ ...base, EFORM_ENCRYPTION_KEY: 'x'.repeat(64) })).toThrow('EFORM_ENCRYPTION_KEY');
    });

    it('requires Telegram webhook secret in production webhook mode', () => {
        expect(() => validateAuthEnvironment({ ...base, TELEGRAM_USE_WEBHOOK: 'true' })).toThrow('TELEGRAM_WEBHOOK_SECRET');
    });
});
