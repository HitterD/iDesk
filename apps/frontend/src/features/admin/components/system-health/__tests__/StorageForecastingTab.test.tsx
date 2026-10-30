import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { StorageForecastingTab } from '../StorageForecastingTab';

// Mock recharts to avoid jsdom SVG measurement errors
vi.mock('recharts', async () => {
    const actual = await vi.importActual<any>('recharts');
    return {
        ...actual,
        ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
    };
});

// Mock api
vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            data: {
                vitals: {
                    totalBytes: 500 * 1024 * 1024 * 1024,
                    usedBytes: 100 * 1024 * 1024 * 1024,
                    freeBytes: 400 * 1024 * 1024 * 1024,
                    usagePercent: 20,
                    diskPath: '/opt/idesk',
                    platform: 'linux',
                },
                breakdown: {
                    attachmentsBytes: 15 * 1024 * 1024 * 1024,
                    databaseBytes: 5 * 1024 * 1024 * 1024,
                    systemOverheadBytes: 80 * 1024 * 1024 * 1024,
                    byFolder: {
                        attachments: { count: 120, sizeBytes: 15 * 1024 * 1024 * 1024 },
                    },
                    topTables: [
                        { tableName: 'ticket_messages', totalBytes: 2500000000, prettySize: '2.33 GB' },
                        { tableName: 'tickets', totalBytes: 1200000000, prettySize: '1.12 GB' },
                    ],
                },
                forecasting: {
                    growthRateBytesPerDay: 20 * 1024 * 1024,
                    growthRateBytesPerMonth: 600 * 1024 * 1024,
                    daysToWarningThreshold: 1600,
                    daysToCriticalThreshold: 1850,
                    estimatedWarningDate: '2030-01-01T00:00:00.000Z',
                    estimatedFullDate: '2031-01-01T00:00:00.000Z',
                    runwayStatus: 'healthy',
                    timeToWarningFormatted: '4.4 tahun',
                    timeToCriticalFormatted: '5.1 tahun',
                },
                projections: [
                    {
                        timestamp: '2026-09-07T00:00:00.000Z',
                        dayOffset: 0,
                        isProjected: false,
                        baselineUsedBytes: 100 * 1024 * 1024 * 1024,
                        highGrowthUsedBytes: 100 * 1024 * 1024 * 1024,
                        peakGrowthUsedBytes: 100 * 1024 * 1024 * 1024,
                        warningThresholdBytes: 425 * 1024 * 1024 * 1024,
                        criticalThresholdBytes: 475 * 1024 * 1024 * 1024,
                        totalCapacityBytes: 500 * 1024 * 1024 * 1024,
                    },
                    {
                        timestamp: '2026-10-07T00:00:00.000Z',
                        dayOffset: 30,
                        isProjected: true,
                        baselineUsedBytes: 100.6 * 1024 * 1024 * 1024,
                        highGrowthUsedBytes: 100.9 * 1024 * 1024 * 1024,
                        peakGrowthUsedBytes: 101.2 * 1024 * 1024 * 1024,
                        warningThresholdBytes: 425 * 1024 * 1024 * 1024,
                        criticalThresholdBytes: 475 * 1024 * 1024 * 1024,
                        totalCapacityBytes: 500 * 1024 * 1024 * 1024,
                    },
                ],
                mitigations: {
                    imageCompressionSavingsBytes: 4 * 1024 * 1024 * 1024,
                    autoCleanupSavingsBytes: 3 * 1024 * 1024 * 1024,
                    totalPotentialSavingsBytes: 7 * 1024 * 1024 * 1024,
                },
                sampledAt: '2026-09-07T09:00:00.000Z',
            },
        }),
    },
}));

describe('StorageForecastingTab', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <StorageForecastingTab />
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('renders hero title and runway status badge', async () => {
        renderComponent();
        expect(await screen.findByText(/Storage Analytics & Capacity Forecasting/i)).toBeInTheDocument();
        expect(await screen.findByText(/Runway: Healthy \(Aman\)/i)).toBeInTheDocument();
    });

    it('renders top metric cards: saturation, runway, and velocity', async () => {
        renderComponent();
        expect(await screen.findByText(/Current Saturation/i)).toBeInTheDocument();
        expect(await screen.findByText(/Runway ke 85% \(Warning\)/i)).toBeInTheDocument();
        expect(await screen.findByText(/Time-To-Full \(95%\)/i)).toBeInTheDocument();
        expect(await screen.findByText(/Laju Pertumbuhan \(Velocity\)/i)).toBeInTheDocument();
    });

    it('renders database tables breakdown list', async () => {
        renderComponent();
        expect(await screen.findByText('ticket_messages')).toBeInTheDocument();
        expect(await screen.findByText('tickets')).toBeInTheDocument();
    });

    it('allows slider resizing simulation and shows gained runway', async () => {
        renderComponent();
        expect(await screen.findByText(/Simulator Resizing Disk/i)).toBeInTheDocument();
        const presetBtn = screen.getByRole('button', { name: '+100 GB' });
        fireEvent.click(presetBtn);

        expect(await screen.findByText(/Hasil Estimasi Simulasi Ekstensi Volume:/i)).toBeInTheDocument();
        expect(await screen.findByText(/Tambahan Waktu Runway:/i)).toBeInTheDocument();
    });
});
