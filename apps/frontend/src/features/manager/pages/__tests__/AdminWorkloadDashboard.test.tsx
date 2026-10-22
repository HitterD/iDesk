import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const auth = { user: { id: 'me', role: 'ADMIN', siteId: 's1' } as { id: string; role: string; siteId: string } };
vi.mock('@/stores/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api', () => ({
    default: { get: vi.fn(() => Promise.resolve({ data: [{ id: 's1', code: 'SPJ', name: 'Sidoarjo', isActive: true }] })) },
}));
const agents = [
    { agentId: 'a1', agentName: 'Merdeka Putra', email: 'm@x.id', role: 'AGENT_ADMIN', totalPoints: 0, appraisalPoints: 92, lastAssignedAt: null, siteId: 's1', siteCode: 'SPJ', siteName: 'Sidoarjo', activeTicketsCount: 0, activeTickets: [] },
    { agentId: 'a2', agentName: 'Beny Saputra', email: 'b@x.id', role: 'AGENT', totalPoints: 8, appraisalPoints: 133, lastAssignedAt: '2026-10-20T03:00:00Z', siteId: 's1', siteCode: 'SPJ', siteName: 'Sidoarjo', activeTicketsCount: 1,
        activeTickets: [{ id: 't1', ticketNumber: '181026-PRO-0009', title: 'Printer', priority: 'CRITICAL', status: 'IN_PROGRESS', category: 'HARDWARE' }] },
];
const recalculate = vi.fn(() => Promise.resolve({}));
vi.mock('@/lib/api/workload.api', () => ({
    workloadApi: {
        getAllAgentWorkloads: vi.fn(() => Promise.resolve({ data: agents })),
        recalculateAgentWorkload: (...args: unknown[]) => recalculate(...args),
        getPriorityWeights: vi.fn(() => Promise.resolve({ data: [] })),
    },
}));

const { AdminWorkloadDashboard } = await import('../AdminWorkloadDashboard');
const renderPage = () => render(<MemoryRouter><AdminWorkloadDashboard /></MemoryRouter>);

describe('AdminWorkloadDashboard (round-2 layout)', () => {
    beforeEach(() => { auth.user = { id: 'me', role: 'ADMIN', siteId: 's1' }; recalculate.mockClear(); });

    it('shows the mockup header, stat cards and level bubbles from real data', async () => {
        renderPage();
        expect(await screen.findByText('Beny Saputra')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Workload Tim Agen' })).toBeInTheDocument();
        expect(screen.getByText('Total Akumulasi Poin')).toBeInTheDocument();
        expect(screen.getByText('Distribusi Beban Rekan Tim (2 Agen)')).toBeInTheDocument();
        expect(screen.getByText('Standby', { selector: '.dash-bub' })).toBeInTheDocument();
        expect(screen.getByText('Tinggi', { selector: '.dash-bub' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '181026-PRO-0009' })).toHaveAttribute('href', '/tickets/t1');
        expect(screen.getByText('Belum ada')).toBeInTheDocument();
    });

    it('filters by status with the segmented control', async () => {
        renderPage();
        await screen.findByText('Beny Saputra');
        await userEvent.click(screen.getByRole('button', { name: 'Standby (1)' }));
        expect(screen.queryByText('Beny Saputra')).not.toBeInTheDocument();
        expect(screen.getByText('Merdeka Putra')).toBeInTheDocument();
    });

    it('lets ADMIN sync an agent; MANAGER only opens dashboards', async () => {
        const { unmount } = renderPage();
        await screen.findByText('Beny Saputra');
        await userEvent.click(screen.getByRole('button', { name: 'Sinkronisasi ulang beban Beny Saputra' }));
        expect(recalculate).toHaveBeenCalledWith('a2', 's1');
        unmount();

        auth.user = { id: 'me', role: 'MANAGER', siteId: 's1' };
        renderPage();
        const row = (await screen.findByText('Beny Saputra')).closest('.res-row') as HTMLElement;
        expect(within(row).getByRole('link', { name: 'Lihat dashboard Beny Saputra' })).toHaveAttribute('href', '/dashboard/agent/a2');
        expect(within(row).queryByRole('button', { name: /Sinkronisasi/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pengaturan Bobot' })).not.toBeInTheDocument();
    });
});
