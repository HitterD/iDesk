import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
    it('returns sampler snapshot without probing database again', async () => {
        const dataSource = { query: jest.fn() } as unknown as DataSource;
        const snapshot = {
            status: 'ok',
            timestamp: '2026-07-27T00:00:00.000Z',
            uptime: 10,
            version: '1.5.0',
            system: {
                cpuUsage: 10,
                memoryUsage: 20,
                memoryTotal: 100,
                memoryFree: 80,
                diskUsage: 30,
                diskTotal: 100,
                diskFree: 70,
                platform: 'win32',
                arch: 'x64',
                nodeVersion: 'v24',
                loadAverage: [0, 0, 0],
            },
            infrastructure: {
                database: { status: 'connected' as const, latency: 2 },
                redis: { status: 'disabled' as const },
                websocket: { status: 'active' as const, clients: 1 },
                backup: { configured: false },
            },
            services: [],
            recentIncidents: [],
            serverTime: '2026-07-27T00:00:00.000Z',
            history: { cpu: [], memory: [], dbLatency: [], redisLatency: [] },
            sampledAt: { fast: '', slow: '' },
        };
        const sampler = { getSnapshot: jest.fn().mockReturnValue(snapshot) };
        const service = new HealthService(
            dataSource,
            { get: jest.fn().mockReturnValue('1.5.0') } as unknown as ConfigService,
            sampler as any,
        );

        await expect(service.getDetailedHealth()).resolves.toEqual(expect.objectContaining({
            status: 'ok',
            uptime: 10,
            services: [],
        }));
        expect(dataSource.query).not.toHaveBeenCalled();
    });

    describe('checkRedisHealth', () => {
        const build = (redisEnabled: string, pingRedis = jest.fn()) => {
            const service = new HealthService(
                { query: jest.fn() } as unknown as DataSource,
                { get: jest.fn().mockReturnValue(redisEnabled) } as unknown as ConfigService,
                { pingRedis } as any,
            );
            return { service, pingRedis };
        };

        it('returns disabled without probing when REDIS_ENABLED is not true', async () => {
            const { service, pingRedis } = build('false');
            await expect(service.checkRedisHealth()).resolves.toEqual({ status: 'disabled' });
            expect(pingRedis).not.toHaveBeenCalled();
        });

        it('returns connected with latency from the authenticated ping', async () => {
            const { service } = build('true', jest.fn().mockResolvedValue({ status: 'connected', latency: 3 }));
            await expect(service.checkRedisHealth()).resolves.toEqual({ status: 'connected', latency: 3 });
        });

        it('returns error instead of disabled when the ping fails', async () => {
            const { service } = build('true', jest.fn().mockResolvedValue({ status: 'error' }));
            await expect(service.checkRedisHealth()).resolves.toEqual({ status: 'error' });
        });
    });

    describe('getReadiness', () => {
        const build = (redisEnabled: string, redis: any, dbFails = false) =>
            new HealthService(
                { query: dbFails ? jest.fn().mockRejectedValue(new Error('down')) : jest.fn() } as unknown as DataSource,
                { get: jest.fn().mockReturnValue(redisEnabled) } as unknown as ConfigService,
                { pingRedis: jest.fn().mockResolvedValue(redis) } as any,
            );

        afterEach(() => {
            delete process.env.AUTH_REFRESH_SESSION_MODE;
        });

        it('is ready in legacy mode even when Redis is disabled', async () => {
            process.env.AUTH_REFRESH_SESSION_MODE = 'legacy';
            await expect(build('false', { status: 'disabled' }).getReadiness()).resolves.toEqual({
                status: 'ready',
                ready: true,
                dependencies: { database: 'connected', redis: 'disabled' },
            });
        });

        it('is not ready when Redis holds security state but errors', async () => {
            process.env.AUTH_REFRESH_SESSION_MODE = 'redis';
            await expect(build('true', { status: 'error' }).getReadiness()).resolves.toEqual({
                status: 'not_ready',
                ready: false,
                dependencies: { database: 'connected', redis: 'error' },
            });
        });

        it('is not ready when the database is down', async () => {
            process.env.AUTH_REFRESH_SESSION_MODE = 'legacy';
            await expect(build('false', { status: 'disabled' }, true).getReadiness()).resolves.toEqual({
                status: 'not_ready',
                ready: false,
                dependencies: { database: 'disconnected', redis: 'disabled' },
            });
        });
    });
});
