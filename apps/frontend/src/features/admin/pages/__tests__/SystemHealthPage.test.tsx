import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SystemHealthPage from '../SystemHealthPage';

const healthSnapshotWithRedis = {
    status: 'ok' as const,
    timestamp: '2026-07-27T00:00:00.000Z',
    serverTime: '2026-07-27T00:00:00.000Z',
    uptime: 93788,
    version: '1.5.0',
    system: {
        cpuUsage: 10,
        memoryUsage: 20,
        memoryTotal: 1000,
        memoryFree: 800,
        diskUsage: 30,
        diskTotal: 1000,
        diskFree: 700,
        platform: 'win32',
        arch: 'x64',
        nodeVersion: 'v24',
        loadAverage: [0, 0, 0],
    },
    infrastructure: {
        database: { status: 'connected' as const, latency: 2 },
        redis: {
            status: 'connected' as const,
            latency: 1,
            detail: {
                usedMemory: 1024 * 1024 * 15,
                keys: 42,
                queues: [
                    { name: 'google-sync', waiting: 2, active: 1, failed: 0 },
                    { name: 'emails', waiting: 0, active: 0, failed: 0 },
                ],
            },
        },
        websocket: { status: 'active' as const, clients: 1 },
        backup: { configured: false },
    },
    services: [],
    recentIncidents: [],
};

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn().mockImplementation((url: string) => {
            if (url === '/backup/status') return Promise.resolve({ data: { configured: false } });
            if (url === '/health/detailed') return Promise.resolve({ data: healthSnapshotWithRedis });
            return Promise.resolve({ data: {} });
        }),
    },
}));

vi.mock('../../hooks/useHealthSocket', () => ({
    useHealthSocket: () => ({
        healthData: healthSnapshotWithRedis,
        uptime: 93788,
        history: { cpu: [10, 20], memory: [30, 40], dbLatency: [5, 6], redisLatency: [1, 2] },
        isStale: false,
        isConnected: true,
        isSubscribed: true,
        lastUpdate: new Date('2026-07-27T00:00:00.000Z'),
        incidents: [],
        connect: vi.fn(),
        disconnect: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    }),
}));

describe('SystemHealthPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
    });

    it('shows ticking uptime and Redis queue depth', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <SystemHealthPage />
            </QueryClientProvider>
        );

        expect(await screen.findByText('1d 2h 3m 08s')).toBeInTheDocument();
        expect(screen.getByText('google-sync')).toBeInTheDocument();
        expect(screen.getByText(/Waiting: 2/)).toBeInTheDocument();
    });
});
