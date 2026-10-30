import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { BentoTvBoardPage } from '../BentoTvBoardPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({
            data: {
                siteName: 'Sampoerna Jaya',
                siteCode: 'SPJ',
                open: [
                    { id: 't1', description: 'Akses Oracle gagal', requesterName: 'Budi', requesterDepartment: 'FIN', assignedToName: null, priority: 'MEDIUM', slaTarget: null, isOverdue: false, isOracleRequest: true, siteCode: 'SMG' },
                    { id: 't2', description: 'Printer rusak', requesterName: 'Cici', requesterDepartment: null, assignedToName: 'Agen B', priority: 'CRITICAL', slaTarget: '2026-07-25T00:00:00.000Z', isOverdue: true, isOracleRequest: false },
                ],
                inProgress: [
                    { id: 't3', description: 'Jaringan lambat', requesterName: 'Muhammad Bagas Saputra Wijaya', requesterDepartment: 'IT', assignedToName: 'Agen A', priority: 'HIGH', slaTarget: null, isOverdue: false, isOracleRequest: false, siteCode: 'SPJ' },
                ],
                waitingVendorCount: 2,
                ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null },
            },
        })),
    },
}));

const socketState = { boardData: null as any, isConnected: true, isTokenInvalid: false };

vi.mock('../../hooks/useTvBoardSocket', () => ({
    useTvBoardSocket: () => socketState,
}));

const ringtoneState = { blocked: false, enqueue: vi.fn(), unlockAudio: vi.fn(), playTestSound: vi.fn() };

vi.mock('../../hooks/useRingtone', () => ({
    useRingtone: () => ringtoneState,
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
        expect(screen.getByText('Waiting Vendor').textContent).toMatch(/Waiting Vendor\s*2/);
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

    it('marks only the overdue card with a red accent and a "Terlambat" label', async () => {
        renderBoard();

        const overdueCard = (await screen.findByText('Printer rusak')).closest('[data-testid="tv-board-card"]');
        const normalCard = (await screen.findByText('Akses Oracle gagal')).closest('[data-testid="tv-board-card"]');
        expect(overdueCard).toHaveAttribute('data-overdue', 'true');
        expect(overdueCard?.textContent).toMatch(/Terlambat/);
        expect(normalCard).not.toHaveAttribute('data-overdue');
        expect(normalCard?.textContent).not.toMatch(/Terlambat/);
    });

    it('scales the whole board with the viewport via the root font size', async () => {
        const { unmount } = renderBoard();
        await screen.findByText('Sampoerna Jaya');

        expect(document.getElementById('tv-board-root-font-size')?.textContent).toMatch(/html \{ font-size: clamp\(/);
        unmount();
        expect(document.getElementById('tv-board-root-font-size')).toBeNull();
    });

    it('lists the overdue ticket above the on-time one', async () => {
        renderBoard();

        await screen.findByText('Printer rusak');
        const rows = screen.getAllByTestId('tv-board-card').map((row) => row.textContent);
        expect(rows.findIndex((text) => text?.includes('Printer rusak')))
            .toBeLessThan(rows.findIndex((text) => text?.includes('Akses Oracle gagal')));
    });

    it('shows the Oracle/K2 badge', async () => {
        renderBoard();
        expect(await screen.findByText('ORACLE / K2')).toBeInTheDocument();
    });

    it('shows the requester name, truncated with a full-name tooltip', async () => {
        renderBoard();

        const requester = await screen.findByText('Muhammad Bagas Saputra Wijaya');
        expect(requester).toHaveAttribute('title', 'Muhammad Bagas Saputra Wijaya');
        expect(requester.className).toContain('truncate');
    });

    it('omits the department line when the requester has none', async () => {
        renderBoard();

        const card = (await screen.findByText('Printer rusak')).closest('[data-testid="tv-board-card"]');
        expect(card).not.toBeNull();
        expect(card?.querySelector('[data-testid="tv-board-department"]')).toBeNull();
    });

    it('shows assignee initials and name', async () => {
        renderBoard();

        const assignee = await screen.findByText('Agen A');
        expect(assignee.className).toContain('font-semibold');
        const card = assignee.closest('[data-testid="tv-board-card"]');
        expect(card?.textContent).toContain('AA');
    });

    it('flags unassigned tickets in the warning colour', async () => {
        renderBoard();

        const unassigned = await screen.findByText('Belum ditugaskan');
        expect(unassigned.className).toContain('text-[var(--tv-warn)]');
    });

    it('hides the muted indicator while audio plays normally', async () => {
        ringtoneState.blocked = false;
        renderBoard();

        await screen.findByText('Sampoerna Jaya');
        expect(screen.queryByTestId('tv-board-audio-blocked')).toBeNull();
    });

    it('shows the muted indicator when the browser blocks audio', async () => {
        ringtoneState.blocked = true;
        renderBoard();

        expect(await screen.findByTestId('tv-board-audio-blocked')).toBeInTheDocument();
        ringtoneState.blocked = false;
    });

    it('shows error page for invalid token on initial load 404', async () => {
        const api = (await import('@/lib/api')).default;
        (api.get as any).mockRejectedValueOnce({ response: { status: 404 } });

        renderBoard('/tv/bad-token');

        expect(await screen.findByText(/Link tidak valid/i)).toBeInTheDocument();
    });

    it('shows periodic sync, not reconnecting, while the socket is down but polling works', async () => {
        socketState.isConnected = false;
        renderBoard();

        expect(await screen.findByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(await screen.findByTestId('tv-board-status-polling')).toBeInTheDocument();
        expect(screen.queryByTestId('tv-board-status-reconnecting')).toBeNull();

        socketState.isConnected = true;
    });

    it('shows reconnecting when both the socket and the poll fail', async () => {
        const api = (await import('@/lib/api')).default;
        socketState.isConnected = false;
        socketState.boardData = { siteName: 'Sampoerna Jaya', siteCode: 'SPJ', open: [], inProgress: [], waitingVendorCount: 0, ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null } };
        (api.get as any).mockRejectedValueOnce(new Error('Network Error'));
        renderBoard();

        expect(await screen.findByTestId('tv-board-status-reconnecting')).toBeInTheDocument();
        expect(screen.getByText('Sampoerna Jaya')).toBeInTheDocument();

        socketState.isConnected = true;
        socketState.boardData = null;
    });

    it('shows the invalid link page when the socket rejects the token', async () => {
        socketState.isTokenInvalid = true;
        renderBoard();

        expect(await screen.findByText(/Link tidak valid/i)).toBeInTheDocument();
        socketState.isTokenInvalid = false;
    });

    it('shows the click-to-enable banner when audio is blocked', async () => {
        ringtoneState.blocked = true;
        renderBoard();

        expect(await screen.findByTestId('tv-board-audio-banner')).toBeInTheDocument();
        ringtoneState.blocked = false;
    });

    it('queues a custom division sound with the built-in one as fallback', async () => {
        const api = (await import('@/lib/api')).default;
        ringtoneState.enqueue.mockClear();
        (api.get as any).mockResolvedValueOnce({
            data: {
                siteName: 'Sampoerna Jaya', siteCode: 'SPJ', waitingVendorCount: 0, inProgress: [],
                open: [{ id: 'n1', description: 'Baru', requesterName: 'A', requesterDepartment: null, assignedToName: null, priority: 'LOW', slaTarget: null, isOverdue: false, isOracleRequest: false, handlingTeam: 'OPS_SUPPORT' }],
                ringtones: { newTicket: null, newTicketSupport: '/uploads/sounds/support.mp3', inProgress: null, closing: null, closingTime: null },
            },
        });
        // The first snapshot only seeds the baseline; a ticket appearing afterwards rings.
        socketState.boardData = { siteName: 'Sampoerna Jaya', siteCode: 'SPJ', open: [], inProgress: [], waitingVendorCount: 0, ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null } };
        renderBoard();

        await screen.findByText('Baru');
        expect(ringtoneState.enqueue).toHaveBeenCalledWith([
            { src: '/uploads/sounds/support.mp3', fallback: '/sounds/divisions/new-ticket-it-support.mp3' },
        ]);
        socketState.boardData = null;
    });

    it('shows reconnecting on startup network error without crashing into fatal error screen', async () => {
        const api = (await import('@/lib/api')).default;
        (api.get as any).mockRejectedValueOnce(new Error('Network Error'));

        renderBoard();

        expect(await screen.findByText('Menghubungkan ke TV Monitoring Board...')).toBeInTheDocument();
        expect(screen.queryByText(/Link tidak valid/i)).toBeNull();
    });

    it('labels only cards from another site with their origin site', async () => {
        renderBoard();
        await screen.findByText('Akses Oracle gagal');

        const labels = screen.getAllByTestId('tv-board-origin-site');
        expect(labels).toHaveLength(1);
        expect(labels[0]).toHaveTextContent('SMG');
    });

    describe('theme', () => {
        afterEach(() => window.localStorage.clear());

        it('follows the admin default when the screen has no override', async () => {
            const api = (await import('@/lib/api')).default;
            const lightBoard = await (api.get as any).getMockImplementation()();
            (api.get as any).mockResolvedValueOnce({ data: { ...lightBoard.data, theme: 'dark' } });
            renderBoard();
            await screen.findByText('Sampoerna Jaya');

            expect(screen.getByTestId('tv-board-root')).toHaveAttribute('data-theme', 'dark');
        });

        it('toggles to dark and remembers the choice for this board link', async () => {
            renderBoard();
            await screen.findByText('Sampoerna Jaya');
            expect(screen.getByTestId('tv-board-root')).toHaveAttribute('data-theme', 'light');

            fireEvent.click(screen.getByTestId('tv-board-theme-toggle'));

            expect(screen.getByTestId('tv-board-root')).toHaveAttribute('data-theme', 'dark');
            expect(window.localStorage.getItem('tv-board-theme:abc-token')).toBe('dark');
        });

        it('clears the override when toggling back to the admin default', async () => {
            window.localStorage.setItem('tv-board-theme:abc-token', 'dark');
            renderBoard();
            await screen.findByText('Sampoerna Jaya');
            expect(screen.getByTestId('tv-board-root')).toHaveAttribute('data-theme', 'dark');

            fireEvent.click(screen.getByTestId('tv-board-theme-toggle'));

            expect(screen.getByTestId('tv-board-root')).toHaveAttribute('data-theme', 'light');
            expect(window.localStorage.getItem('tv-board-theme:abc-token')).toBeNull();
        });
    });

    it('retains board data when background poll fails after initial load', async () => {
        const api = (await import('@/lib/api')).default;
        renderBoard();

        expect(await screen.findByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(screen.getByText('Akses Oracle gagal')).toBeInTheDocument();

        // Subsequent poll encounters network failure
        (api.get as any).mockRejectedValueOnce(new Error('Network Error'));

        // Data stays intact on the screen without crashing
        expect(screen.getByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(screen.getByText('Akses Oracle gagal')).toBeInTheDocument();
        expect(screen.queryByText(/Link tidak valid/i)).toBeNull();
    });
});
