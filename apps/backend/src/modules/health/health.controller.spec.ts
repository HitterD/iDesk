import { HealthController } from './health.controller';

describe('HealthController', () => {
    it('returns liveness without dependency checks', () => {
        const controller = new HealthController({} as any, {} as any);
        expect(controller.live()).toEqual({ status: 'alive' });
    });

    it('sets HTTP 503 when readiness is false', async () => {
        const controller = new HealthController(
            {
                getReadiness: jest.fn().mockResolvedValue({ ready: false, status: 'not-ready' }),
            } as any,
            {} as any
        );
        const response = { status: jest.fn() } as any;
        await controller.ready(response);
        expect(response.status).toHaveBeenCalledWith(503);
    });

    it('returns recent traces from traceCollector', () => {
        const mockTraces = [{ traceId: 'trace-123' }];
        const controller = new HealthController(
            {} as any,
            { getRecentTraces: jest.fn().mockReturnValue(mockTraces) } as any
        );
        expect(controller.getRecentTraces()).toEqual(mockTraces);
    });
});
