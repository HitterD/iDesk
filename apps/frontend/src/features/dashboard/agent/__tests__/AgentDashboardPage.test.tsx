import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentDashboardPage } from '../AgentDashboardPage';
import type { AgentDashboardData } from '../agentDashboard.types';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: vi.fn() }));
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'me-1', role: 'AGENT_WEB_DEV' } }),
}));
vi.mock('../../components/MyRatingCard', () => ({ MyRatingCard: () => <div>MyRatingCard</div> }));
// recharts' ResponsiveContainer needs real layout; jsdom has none.
vi.mock('recharts', async (orig) => {
    const actual = await orig<typeof import('recharts')>();
    return { ...actual, ResponsiveContainer: ({ children }: any) => <div>{children}</div> };
});

const stats: AgentDashboardData['stats'] = {
    periodDays: 30, active: 4, todo: 2, inProgress: 1, waitingVendor: 1, overdue: 1,
    resolvedToday: 2, resolvedThisWeek: 5, resolvedThisMonth: 9, resolvedInPeriod: 9,
    slaCompliance: 88, avgResolveMinutes: 95,
    trend: [{ date: '2026-10-07', assigned: 1, resolved: 2 }],
    activeTickets: [{ id: 't1', ticketNumber: 'WD-1', title: 'Fix login', status: 'IN_PROGRESS', priority: 'HIGH', slaTarget: null, isOverdue: false }],
    byStatus: { TODO: 2, IN_PROGRESS: 1 },
    byCategory: [{ category: 'WEB', count: 3 }],
    aging: { lt3: 1, d3to7: 1, d7to14: 1, gt14: 1 },
};

const dashboard = (over: Partial<AgentDashboardData>): AgentDashboardData => ({
    agent: { id: 'me-1', fullName: 'Dev One', role: 'AGENT_WEB_DEV', avatarUrl: null, appraisalPoints: 12, scope: 'ICT', site: null },
    kind: 'dev',
    generatedAt: '2026-10-07T03:00:00.000Z',
    stats,
    rating: { average: 4.5, count: 2 },
    support: null,
    ...over,
});

const renderAt = (path: string) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/dashboard/me" element={<AgentDashboardPage />} />
                <Route path="/dashboard/agent/:id" element={<AgentDashboardPage />} />
            </Routes>
        </MemoryRouter>
    </QueryClientProvider>,
);

describe('AgentDashboardPage', () => {
    beforeEach(() => api.get.mockReset());

    it('shows my own dev dashboard with breakdowns and no support card', async () => {
        api.get.mockResolvedValue({ data: dashboard({}) });
        renderAt('/dashboard/me');

        expect(await screen.findByText('Dashboard Saya')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/agent-dashboard/me', { params: { days: 30 } });
        expect(screen.getByText('Umur Tiket Aktif')).toBeInTheDocument();
        expect(screen.getByText('Fix login')).toBeInTheDocument();
        expect(screen.getByText('MyRatingCard')).toBeInTheDocument();
        expect(screen.queryByText('Workload & Instalasi')).not.toBeInTheDocument();
    });

    it("shows another support agent's dashboard for ADMIN/MANAGER", async () => {
        api.get.mockResolvedValue({
            data: dashboard({
                agent: { id: 'a-2', fullName: 'Support Two', role: 'AGENT', avatarUrl: null, appraisalPoints: 3, scope: 'ICT', site: null },
                kind: 'support',
                support: { workloadPointsToday: 8, installs: [] },
            }),
        });
        renderAt('/dashboard/agent/a-2');

        expect(await screen.findByText('Dashboard Support Two')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/agent-dashboard/agents/a-2', { params: { days: 30 } });
        expect(screen.getByText('Workload & Instalasi')).toBeInTheDocument();
        expect(screen.queryByText('Umur Tiket Aktif')).not.toBeInTheDocument();
        expect(screen.queryByText('MyRatingCard')).not.toBeInTheDocument();
        expect(screen.getByText('Rating & Appraisal')).toBeInTheDocument();
    });

    it('shows a retry state when the API returns no dashboard', async () => {
        api.get.mockResolvedValue({ data: {} });
        renderAt('/dashboard/agent/x');
        expect(await screen.findByText('Gagal memuat dashboard agent.')).toBeInTheDocument();
    });
});
