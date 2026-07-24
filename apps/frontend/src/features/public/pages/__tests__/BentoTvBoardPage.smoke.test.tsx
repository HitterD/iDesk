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
                    { id: 't1', description: 'Akses Oracle gagal', requesterName: 'Budi', assignedToName: null, priority: 'MEDIUM', slaTarget: null, isOverdue: false, isOracleRequest: true },
                    { id: 't2', description: 'Printer rusak', requesterName: 'Cici', assignedToName: 'Agen B', priority: 'CRITICAL', slaTarget: '2026-07-25T00:00:00.000Z', isOverdue: true, isOracleRequest: false },
                ],
                inProgress: [],
                resolved: [],
                waitingVendorCount: 2,
            },
        })),
    },
}));

vi.mock('../../hooks/useTvBoardSocket', () => ({
    useTvBoardSocket: () => ({ boardData: null, isConnected: true }),
}));

describe('BentoTvBoardPage', () => {
    it('renders site name, 3 columns, and waiting vendor badge from initial fetch', async () => {
        render(
            <MemoryRouter initialEntries={['/tv/abc-token']}>
                <Routes>
                    <Route path="/tv/:token" element={<BentoTvBoardPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(screen.getByText(/Open/)).toBeInTheDocument();
        expect(screen.getByText(/In Progress/)).toBeInTheDocument();
        expect(screen.getByText(/Resolved/)).toBeInTheDocument();
        expect(screen.getByText(/Waiting Vendor: 2/)).toBeInTheDocument();
        expect(await screen.findByText('ORACLE / K2')).toBeInTheDocument();
        expect(screen.getByText('Akses Oracle gagal')).toBeInTheDocument();
        expect(screen.getByText('Printer rusak')).toBeInTheDocument();
    });

    it('shows overdue indicator (red border) on overdue card but not on normal card', async () => {
        render(
            <MemoryRouter initialEntries={['/tv/abc-token']}>
                <Routes>
                    <Route path="/tv/:token" element={<BentoTvBoardPage />} />
                </Routes>
            </MemoryRouter>
        );

        const overdueCard = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
        const normalCard = (await screen.findByText('Akses Oracle gagal')).closest('div[data-testid="tv-board-card"]');
        expect(overdueCard?.className).toContain('border-red-600');
        expect(normalCard?.className).not.toContain('border-red-600');
    });

    it('shows error page for invalid token', async () => {
        const api = (await import('@/lib/api')).default;
        (api.get as any).mockRejectedValueOnce({ response: { status: 404 } });

        render(
            <MemoryRouter initialEntries={['/tv/bad-token']}>
                <Routes>
                    <Route path="/tv/:token" element={<BentoTvBoardPage />} />
                </Routes>
            </MemoryRouter>
        );

        expect(await screen.findByText(/Link tidak valid/i)).toBeInTheDocument();
    });
});
