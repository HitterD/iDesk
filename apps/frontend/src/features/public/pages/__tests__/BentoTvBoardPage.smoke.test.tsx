import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { BentoTvBoardPage } from '../BentoTvBoardPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({
            data: {
                siteName: 'Sampoerna Jaya',
                siteCode: 'SPJ',
                open: [
                    { id: 't1', description: 'Akses Oracle gagal', requesterName: 'Budi', requesterDepartment: 'FIN', assignedToName: null, priority: 'MEDIUM', slaTarget: null, isOverdue: false, isOracleRequest: true },
                    { id: 't2', description: 'Printer rusak', requesterName: 'Cici', requesterDepartment: null, assignedToName: 'Agen B', priority: 'CRITICAL', slaTarget: '2026-07-25T00:00:00.000Z', isOverdue: true, isOracleRequest: false },
                ],
                inProgress: [
                    { id: 't3', description: 'Jaringan lambat', requesterName: 'Muhammad Bagas Saputra Wijaya', requesterDepartment: 'IT', assignedToName: 'Agen A', priority: 'HIGH', slaTarget: null, isOverdue: false, isOracleRequest: false },
                ],
                waitingVendorCount: 2,
            },
        })),
    },
}));

vi.mock('../../hooks/useTvBoardSocket', () => ({
    useTvBoardSocket: () => ({ boardData: null, isConnected: true }),
}));

function renderBoard(entry = '/tv/abc-token') {
    return render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/tv/:token" element={<BentoTvBoardPage />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('BentoTvBoardPage', () => {
    it('renders only Open and In Progress columns', async () => {
        renderBoard();

        expect(await screen.findByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(screen.getByText(/Open/)).toBeInTheDocument();
        expect(screen.getByText(/In Progress/)).toBeInTheDocument();
        expect(screen.queryByText(/Resolved/)).not.toBeInTheDocument();
        expect(screen.queryByText('(Minggu ini)')).not.toBeInTheDocument();
        expect(screen.getByText(/Waiting Vendor: 2/)).toBeInTheDocument();
    });

    it('gives Open 2 of 5 grid columns and In Progress 3 of 5', async () => {
        renderBoard();

        const openSection = (await screen.findByText('Open')).closest('section');
        const inProgressSection = (await screen.findByText('In Progress')).closest('section');
        expect(openSection?.className).toContain('md:col-span-2');
        expect(inProgressSection?.className).toContain('md:col-span-3');
    });

    it('locks page height so columns overflow instead of the page', async () => {
        const { container } = renderBoard();
        await screen.findByText('Sampoerna Jaya');

        const root = container.firstElementChild as HTMLElement;
        expect(root.className).toContain('h-[100dvh]');
        expect(root.className).toContain('overflow-hidden');
        expect(root.className).not.toContain('min-h-[100dvh]');
    });

    it('shows overdue indicator (red border) on overdue card but not on normal card', async () => {
        renderBoard();

        const overdueCard = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
        const normalCard = (await screen.findByText('Akses Oracle gagal')).closest('div[data-testid="tv-board-card"]');
        expect(overdueCard?.className).toContain('border-red-600');
        expect(normalCard?.className).not.toContain('border-red-600');
    });

    it('shows the Oracle/K2 badge', async () => {
        renderBoard();
        expect(await screen.findByText('ORACLE / K2')).toBeInTheDocument();
    });

    it('shows requester name and department on separate lines', async () => {
        renderBoard();

        const requester = await screen.findByText('Muhammad Bagas Saputra Wijaya');
        expect(requester).toHaveAttribute('title', 'Muhammad Bagas Saputra Wijaya');
        expect(requester.className).toContain('truncate');
        expect(screen.getByText('IT')).toBeInTheDocument();
    });

    it('omits the department line when the requester has none', async () => {
        renderBoard();

        const card = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
        expect(card).not.toBeNull();
        expect(card?.querySelector('[data-testid="tv-board-department"]')).toBeNull();
    });

    it('shows assignee initials and name prominently', async () => {
        renderBoard();

        const assignee = await screen.findByText('Agen A');
        expect(assignee.className).toContain('font-bold');
        const card = assignee.closest('div[data-testid="tv-board-card"]');
        expect(card?.textContent).toContain('AA');
    });

    it('flags unassigned tickets in amber', async () => {
        renderBoard();

        const unassigned = await screen.findByText('Belum ditugaskan');
        expect(unassigned.className).toContain('text-amber');
    });

    it('shows error page for invalid token', async () => {
        const api = (await import('@/lib/api')).default;
        (api.get as any).mockRejectedValueOnce({ response: { status: 404 } });

        renderBoard('/tv/bad-token');

        expect(await screen.findByText(/Link tidak valid/i)).toBeInTheDocument();
    });
});
