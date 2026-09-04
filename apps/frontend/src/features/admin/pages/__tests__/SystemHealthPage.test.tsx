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

        const uptimeElements = await screen.findAllByText('1d 2h 3m 08s');
        expect(uptimeElements.length).toBeGreaterThan(0);
        expect(screen.getByText('google-sync')).toBeInTheDocument();
        expect(screen.getByText(/2 · 1 · 0/)).toBeInTheDocument();
    });

    it('switches to End-to-End Service Map tab when tab button is clicked', async () => {
        const { fireEvent } = await import('@testing-library/react');
        render(
            <QueryClientProvider client={queryClient}>
                <SystemHealthPage />
            </QueryClientProvider>
        );

        // Click on the End-to-End Service Map tab
        const serviceMapTab = screen.getByTestId('tab-service-map');
        expect(serviceMapTab).toBeInTheDocument();
        fireEvent.click(serviceMapTab);

        // Verify that the End-to-End Service Map content is rendered
        expect(screen.getAllByText(/Traces/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/1\. Client Edge/i)).toBeInTheDocument();
        expect(screen.getByText(/iDesk Web Portal/i)).toBeInTheDocument();

        // Switch back to Overview & Vitals tab
        const vitalsTab = screen.getByTestId('tab-vitals');
        fireEvent.click(vitalsTab);
        expect(screen.getByText('google-sync')).toBeInTheDocument();
    });
});
