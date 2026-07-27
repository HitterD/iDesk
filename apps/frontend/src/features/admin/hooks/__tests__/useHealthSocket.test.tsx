import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useHealthSocket } from '../useHealthSocket';

const handlers = new Map<string, (payload?: any) => void>();
const socket = {
    connected: true,
    on: vi.fn((event: string, handler: (payload?: any) => void) => {
        handlers.set(event, handler);
        return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
};

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => socket),
}));

const snapshot = {
    status: 'ok' as const,
    timestamp: '2026-07-27T00:00:00.000Z',
    serverTime: '2026-07-27T00:00:00.000Z',
    uptime: 100,
    version: '1.5.0',
    system: {
        cpuUsage: 10,
        memoryUsage: 20,
        memoryTotal: 100,
        memoryFree: 80,
        diskUsage: 0,
        diskTotal: 0,
        diskFree: 0,
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
    history: { cpu: [10], memory: [20], dbLatency: [2], redisLatency: [] },
    sampledAt: { fast: '2026-07-27T00:00:00.000Z', slow: '2026-07-27T00:00:00.000Z' },
};

describe('useHealthSocket', () => {
    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('ticks uptime locally and resyncs on a fast update', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useHealthSocket(true));

        act(() => {
            handlers.get('health:snapshot')?.(snapshot);
        });
        act(() => {
            vi.advanceTimersByTime(3_000);
        });
        expect(result.current.uptime).toBeCloseTo(103, 0);

        act(() => {
            handlers.get('health:fast')?.({
                serverTime: '2026-07-27T00:00:04.000Z',
                uptime: 200,
                cpuUsage: 11,
                memoryUsage: 21,
                memoryFree: 79,
                loadAverage: [0, 0, 0],
                database: { status: 'connected', latency: 3 },
                redis: { status: 'disabled' },
                websocket: { status: 'active', clients: 2 },
            });
        });
        expect(result.current.uptime).toBe(200);
    });

    it('sets stale after six seconds without a fast update', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useHealthSocket(true));
        act(() => {
            handlers.get('health:snapshot')?.(snapshot);
        });
        act(() => {
            vi.advanceTimersByTime(6_001);
        });
        expect(result.current.isStale).toBe(true);
    });

    it('caps history at 60 entries and merges slow update cleanly', () => {
        const { result } = renderHook(() => useHealthSocket(true));
        act(() => {
            handlers.get('health:snapshot')?.(snapshot);
        });

        for (let i = 0; i < 65; i++) {
            act(() => {
                handlers.get('health:fast')?.({
                    serverTime: new Date().toISOString(),
                    uptime: 100 + i,
                    cpuUsage: i,
                    memoryUsage: 20,
                    memoryFree: 80,
                    loadAverage: [0, 0, 0],
                    database: { status: 'connected', latency: 2 },
                    redis: { status: 'disabled' },
                    websocket: { status: 'active', clients: 1 },
                });
            });
        }

        expect(result.current.history.cpu).toHaveLength(60);
        expect(result.current.history.cpu[0]).toBe(5);
        expect(result.current.history.cpu.at(-1)).toBe(64);

        act(() => {
            handlers.get('health:slow')?.({
                serverTime: new Date().toISOString(),
                status: 'ok',
                disk: { diskUsage: 45, diskTotal: 1000, diskFree: 550 },
                services: [],
                backup: { configured: true, connected: true },
            });
        });

        expect(result.current.healthData?.system.diskUsage).toBe(45);
        expect(result.current.history.cpu).toHaveLength(60);
    });
});
