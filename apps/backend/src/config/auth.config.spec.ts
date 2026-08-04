import { validateAuthEnvironment } from './auth.config';

describe('validateAuthEnvironment', () => {
    const base = {
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(32),
        DB_HOST: 'postgres',
        DB_PASSWORD: 'db-secret',
        DB_DATABASE: 'idesk',
        FRONTEND_URL: 'https://app.example.com',
        WS_CORS_ORIGIN: 'https://app.example.com',
        ENCRYPTION_KEY: 'x'.repeat(32),
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
});
