import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const auth = { user: { id: 'me', role: 'ADMIN', siteId: 's1' } as { id: string; role: string; siteId: string } };
vi.mock('@/stores/useAuth', () => ({ useAuth: () => auth }));
const get = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('recharts', async (orig) => {
    const mod = await orig<typeof import('recharts')>();
    return { ...mod, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div style={{ width: 600, height: 200 }}>{children}</div> };
});

const volume = {
    daily: [{ date: '2026-10-01', created: 4, resolved: 2, pending: 2 }, { date: '2026-10-02', created: 6, resolved: 5, pending: 1 }],
    byPriority: { CRITICAL: 1, MEDIUM: 9 }, byCategory: {}, byStatus: { TODO: 3, IN_PROGRESS: 2, RESOLVED: 5 },
    summary: { totalCreated: 10, totalResolved: 7, totalPending: 3, avgPerDay: 5, peakDay: '2026-10-02', peakCount: 6 },
};

const { BentoReportsPage } = await import('../BentoReportsPage');
const renderAt = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <BentoReportsPage />
        </QueryClientProvider>
    </MemoryRouter>,
);

describe('BentoReportsPage (round-2 layout)', () => {
    beforeEach(() => {
        auth.user = { id: 'me', role: 'ADMIN', siteId: 's1' };
        get.mockReset();
        get.mockImplementation((url: string) => {
            if (url.startsWith('/reports/monthly')) return Promise.resolve({ data: { month: 10, year: 2026, totalTickets: 277, resolvedTickets: 214, openTickets: 63, avgResolutionTimeHours: '4.33' } });
            if (url.startsWith('/reports/ticket-volume')) return Promise.resolve({ data: { data: volume } });
            if (url.startsWith('/reports/agent-performance')) return Promise.resolve({ data: { data: [] } });
            return Promise.resolve({ data: [] });
        });
    });

    it('shows monthly cards from /reports/monthly and breakdown from the month ticket-volume range', async () => {
        renderAt('/reports');
        expect(await screen.findByText('277')).toBeInTheDocument();
        expect(screen.getByText('77% resolution rate')).toBeInTheDocument();
        expect(screen.getByText('4j 20m')).toBeInTheDocument();
        await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\/ticket-volume\?startDate=\d{4}-\d{2}-01&endDate=/)));
        expect(await screen.findByRole('img', { name: /Per status: Open 3, In Progress 2/ })).toBeInTheDocument();
        for (const name of ['Pratinjau PDF', 'PDF', 'Excel']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pilih tim' })).toBeInTheDocument();
    });

    it('opens the tab from ?tab= and shows the locked team for agents', async () => {
        auth.user = { id: 'me', role: 'AGENT_ORACLE', siteId: 's1' };
        renderAt('/reports?tab=volume');
        expect(await screen.findByText('Total Created')).toBeInTheDocument();
        expect(await screen.findByText('6 tiket')).toBeInTheDocument();
        expect(screen.getByLabelText('Tim ICT: Oracle / K2')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pilih tim' })).not.toBeInTheDocument();
    });
});
