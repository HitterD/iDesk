import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

        expect(await screen.findByRole('region', { name: 'Dashboard Saya' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Selamat (pagi|siang|sore|malam), Dev/);
        expect(screen.getByText('Ada 4 tiket aktif, 1 di antaranya lewat SLA.')).toBeInTheDocument();
        expect(screen.getByText(/Agent Web Dev · Lingkup ICT/)).toBeInTheDocument();
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

        expect(await screen.findByRole('region', { name: 'Dashboard Support Two' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Kembali/ })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Support Two');
        expect(api.get).toHaveBeenCalledWith('/agent-dashboard/agents/a-2', { params: { days: 30 } });
        expect(screen.getByText('Workload & Instalasi')).toBeInTheDocument();
        expect(screen.queryByText('Umur Tiket Aktif')).not.toBeInTheDocument();
        expect(screen.queryByText('MyRatingCard')).not.toBeInTheDocument();
        expect(screen.getByText('Rating')).toBeInTheDocument();
        expect(screen.getByText('dari 2 penilaian')).toBeInTheDocument();
    });

    it('shows a retry state when the API returns no dashboard', async () => {
        api.get.mockResolvedValue({ data: {} });
        renderAt('/dashboard/agent/x');
        expect(await screen.findByText('Gagal memuat dashboard agent.')).toBeInTheDocument();
    });

    it('shows mockup SLA bubbles: compact countdown, overdue, paused for waiting vendor, and no SLA', async () => {
        const soon = new Date(Date.now() + 71 * 60_000).toISOString();
        const past = new Date(Date.now() - 100 * 60_000 - 30_000).toISOString();
        api.get.mockResolvedValue({ data: dashboard({ stats: { ...stats, activeTickets: [
            { id: 'a', ticketNumber: 'N-1', title: 'Late one', status: 'IN_PROGRESS', priority: 'CRITICAL', slaTarget: past, isOverdue: true },
            { id: 'b', ticketNumber: 'N-2', title: 'Soon one', status: 'TODO', priority: 'HIGH', slaTarget: soon, isOverdue: false },
            { id: 'c', ticketNumber: 'N-3', title: 'Vendor one', status: 'WAITING_VENDOR', priority: 'MEDIUM', slaTarget: past, isOverdue: false },
            { id: 'd', ticketNumber: 'N-4', title: 'No SLA one', status: 'TODO', priority: 'LOW', slaTarget: null, isOverdue: false },
            // Stale flag after an SLA extension: the future target wins, no red "Sisa".
            { id: 'e', ticketNumber: 'N-5', title: 'Extended one', status: 'IN_PROGRESS', priority: 'HIGH', slaTarget: soon, isOverdue: true },
        ] } }) });
        renderAt('/dashboard/me');

        const list = await screen.findByRole('region', { name: 'Perlu perhatian' });
        const row = (title: string) => within(list).getByText(title).closest('a') as HTMLElement;
        expect(row('Late one')).toHaveTextContent('Lewat 1j 40m');
        expect(row('Soon one')).toHaveTextContent(/Sisa 1j 1[01]m/);
        expect(row('Vendor one')).toHaveTextContent('Dijeda');
        expect(row('Vendor one')).not.toHaveTextContent('Lewat');
        expect(row('No SLA one')).toHaveTextContent('Tanpa SLA');
        expect(row('Extended one')).toHaveTextContent(/Sisa 1j 1[01]m/);
        const bubColor = (title: string) => (row(title).querySelector('.dash-bub') as HTMLElement).style.getPropertyValue('--c');
        expect(bubColor('Extended one')).toBe('var(--dash-blue)');
        expect(bubColor('Late one')).toBe('var(--dash-red)');
        expect(row('Late one')).toHaveAttribute('href', '/tickets/a');
        expect(within(list).getByRole('link', { name: /Lihat semua/ })).toHaveAttribute('href', '/tickets/list?filter=assigned_to_me');
    });

    it('requests the chosen period and shows weekly trend copy beyond 14 days', async () => {
        api.get.mockImplementation((_url: string, opts?: { params?: { days?: number } }) =>
            Promise.resolve({ data: dashboard({ stats: { ...stats, periodDays: opts?.params?.days ?? 30 } }) }));
        renderAt('/dashboard/me');

        expect(await screen.findByText('Tiket ditugaskan vs diselesaikan per minggu')).toBeInTheDocument();
        const period = screen.getByRole('group', { name: 'Periode' });
        expect(within(period).getByRole('button', { name: '30 hari' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(within(period).getByRole('button', { name: '7 hari' }));
        expect(await screen.findByText('Tiket ditugaskan vs diselesaikan per hari')).toBeInTheDocument();
        expect(api.get).toHaveBeenLastCalledWith('/agent-dashboard/me', { params: { days: 7 } });
        expect(screen.getByText('Performa 7 hari')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Ringkasan' })).toHaveTextContent('7 hari terakhir');
    });
});
