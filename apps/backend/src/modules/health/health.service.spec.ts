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
});
