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

    it('keeps waiting-vendor tickets under the PIC but out of the workload count', async () => {
        agents.push({ agentId: 'a3', agentName: 'Rm Bagastyo', email: 'r@x.id', role: 'AGENT', totalPoints: 2, appraisalPoints: 0, lastAssignedAt: null, siteId: 's1', siteCode: 'SPJ', siteName: 'Sidoarjo',
            activeTicketsCount: 1, waitingVendorCount: 1,
            activeTickets: [
                { id: 't2', ticketNumber: '271026-TAL-0021', title: 'Flashdisk', priority: 'LOW', status: 'IN_PROGRESS', category: 'HARDWARE' },
                { id: 'v1', ticketNumber: '081026-RMW-0003', title: 'Printer', priority: 'HIGH', status: 'WAITING_VENDOR', category: 'HARDWARE' },
            ] } as typeof agents[number]);
        try {
            renderPage();
            await screen.findByText('Rm Bagastyo');
            const card = screen.getByText('Tiket Aktif Dalam Proses').closest('.queue-stat') as HTMLElement;
            // 1 (Beny) + 1 (Bagastyo); the vendor ticket is excluded from the count.
            expect(within(card).getByText('2')).toBeInTheDocument();
            expect(within(card).getByText(/1 tunggu vendor/)).toBeInTheDocument();
            const vendorChip = screen.getByRole('link', { name: /081026-RMW-0003/ });
            expect(vendorChip).toHaveAttribute('title', expect.stringMatching(/tunggu vendor.*tidak dihitung poin/i));
        } finally {
            agents.pop();
        }
    });

    it('marks waiting-vendor tickets inside the "+N lainnya" popover too', async () => {
        const chip = (id: string, status: string) => ({ id, ticketNumber: id, title: `Tiket ${id}`, priority: 'LOW', status, category: 'HARDWARE' });
        agents.push({ agentId: 'a4', agentName: 'Popover Agent', email: 'p@x.id', role: 'AGENT', totalPoints: 1, appraisalPoints: 0, lastAssignedAt: null, siteId: 's1', siteCode: 'SPJ', siteName: 'Sidoarjo',
            activeTicketsCount: 3, waitingVendorCount: 1,
            activeTickets: [chip('T-1', 'IN_PROGRESS'), chip('T-2', 'TODO'), chip('T-3', 'TODO'), chip('V-9', 'WAITING_VENDOR')] } as typeof agents[number]);
        try {
            renderPage();
            await screen.findByText('Popover Agent');
            await userEvent.click(screen.getByRole('button', { name: '1 tiket lainnya milik Popover Agent' }));
            const vendorItem = (await screen.findByText('Tiket V-9')).closest('a') as HTMLElement;
            expect(within(vendorItem).getByText('Tunggu vendor, tidak dihitung poin')).toBeInTheDocument();
            const workableItem = screen.getAllByText('Tiket T-1').map((el) => el.closest('a') as HTMLElement).find(Boolean)!;
            expect(within(workableItem).queryByText(/tunggu vendor/i)).not.toBeInTheDocument();
        } finally {
            agents.pop();
        }
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
