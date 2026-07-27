import { ConfigService } from '@nestjs/config';
import { HealthSamplerService } from './health-sampler.service';
import { HISTORY_SIZE } from './dto/health.dto';

describe('HealthSamplerService', () => {
    const healthService = {
        getFastSystemMetrics: jest.fn(),
        checkDatabaseHealth: jest.fn(),
        checkBackupStatus: jest.fn(),
        getServicesStatus: jest.fn(),
        getDiskUsage: jest.fn(),
        getOverallStatus: jest.fn(),
        getRecentIncidents: jest.fn().mockReturnValue([]),
    };
    const gateway = {
        pushFast: jest.fn(),
        pushSlow: jest.fn(),
        pushIncident: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        healthService.getFastSystemMetrics.mockResolvedValue({
            cpuUsage: 12, memoryUsage: 40, memoryTotal: 1000, memoryFree: 600,
            platform: 'win32', arch: 'x64', nodeVersion: 'v24', loadAverage: [0, 0, 0],
        });
        healthService.checkDatabaseHealth.mockResolvedValue({ status: 'connected', latency: 3 });
        healthService.checkBackupStatus.mockResolvedValue({ configured: false });
        healthService.getServicesStatus.mockResolvedValue([]);
        healthService.getDiskUsage.mockResolvedValue({ usage: 50, total: 1000, free: 500 });
        healthService.getOverallStatus.mockReturnValue('ok');
    });

    it('refreshes fast probes without running slow probes', async () => {
        const sampler = new HealthSamplerService(
            healthService as any,
            gateway as any,
            { get: jest.fn().mockReturnValue('false') } as unknown as ConfigService,
        );

        await sampler.refreshFastTier();

        expect(healthService.getFastSystemMetrics).toHaveBeenCalledTimes(1);
        expect(healthService.checkDatabaseHealth).toHaveBeenCalledTimes(1);
        expect(healthService.getServicesStatus).not.toHaveBeenCalled();
        expect(gateway.pushFast).toHaveBeenCalledWith(expect.objectContaining({ uptime: expect.any(Number) }));
    });

    it('keeps only HISTORY_SIZE values in oldest-to-newest order', async () => {
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        for (let index = 0; index < HISTORY_SIZE + 1; index++) {
            healthService.getFastSystemMetrics.mockResolvedValueOnce({
                cpuUsage: index, memoryUsage: 40, memoryTotal: 1000, memoryFree: 600,
                platform: 'win32', arch: 'x64', nodeVersion: 'v24', loadAverage: [0, 0, 0],
            });
            await sampler.refreshFastTier();
        }

        expect(sampler.getHistory().cpu).toHaveLength(HISTORY_SIZE);
        expect(sampler.getHistory().cpu[0]).toBe(1);
        expect(sampler.getHistory().cpu.at(-1)).toBe(HISTORY_SIZE);
    });

    it('reports disabled Redis without constructing a client', async () => {
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        await sampler.refreshFastTier();

        expect(sampler.getFastUpdate().redis).toEqual({ status: 'disabled' });
    });

    it('keeps fast data valid when the database probe rejects', async () => {
        healthService.checkDatabaseHealth.mockRejectedValue(new Error('DB offline'));
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        await sampler.refreshFastTier();

        expect(sampler.getFastUpdate()).toEqual(expect.objectContaining({
            cpuUsage: 12,
            database: expect.objectContaining({ status: 'disconnected' }),
        }));
    });

    it('emits each new incident only once', async () => {
        healthService.getRecentIncidents
            .mockReturnValueOnce([{ id: 'inc-1', timestamp: new Date().toISOString() }])
            .mockReturnValueOnce([{ id: 'inc-1', timestamp: new Date().toISOString() }]);
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        await sampler.refreshSlowTier();
        await sampler.refreshSlowTier();

        expect(gateway.pushIncident).toHaveBeenCalledTimes(1);
    });

    it('includes all six queues with zero fallback when Redis detail is unavailable', async () => {
        const sampler = new HealthSamplerService(healthService as any, gateway as any, {
            get: jest.fn().mockReturnValue('false'),
        } as unknown as ConfigService);

        await sampler.refreshSlowTier();

        expect(sampler.getSlowUpdate().redisDetail).toBeUndefined();
        expect(gateway.pushSlow).toHaveBeenCalledWith(expect.objectContaining({ services: [] }));
    });
});
