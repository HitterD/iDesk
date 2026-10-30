import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '@/lib/api';
import { BentoMyTicketsPage } from '../BentoMyTicketsPage';

const mockTickets = [
    {
        id: 't-1',
        ticketNumber: '190826-GEN-0001',
        title: 'Komputer tidak bisa menyala',
        status: 'TODO',
        priority: 'HIGH',
        category: 'HARDWARE',
        createdAt: '2026-08-19T08:00:00.000Z',
        updatedAt: '2026-08-19T10:00:00.000Z',
        hasUnreadChat: true,
        assignedTo: {
            id: 'agent-1',
            fullName: 'Yudi Arta Trirensila',
        },
    },
    {
        id: 't-2',
        ticketNumber: '190826-GEN-0002',
        title: 'Koneksi printer terputus',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        category: 'HARDWARE',
        createdAt: '2026-08-18T08:00:00.000Z',
        updatedAt: '2026-08-18T10:00:00.000Z',
        hasUnreadChat: false,
        assignedTo: null,
    },
];

/** Per-status totals returned by the `limit=1` stats probes. */
const STAT_TOTALS: Record<string, number> = { all: 17, TODO: 3, IN_PROGRESS: 5, WAITING_VENDOR: 1, RESOLVED: 4, CLOSED: 2 };

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.includes('/tickets/paginated')) {
                const params = new URLSearchParams(url.split('?')[1]);
                if (params.get('limit') === '1') {
                    const total = STAT_TOTALS[params.get('status') ?? 'all'];
                    return Promise.resolve({ data: { data: [], meta: { total } } });
                }
                return Promise.resolve({
                    data: {
                        data: mockTickets,
                        meta: {
                            total: 12,
                            page: Number(params.get('page')),
                            limit: 10,
                            totalPages: 2,
                            hasNextPage: params.get('page') === '1',
                            hasPrevPage: params.get('page') !== '1',
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        }),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'u-1', role: 'USER', fullName: 'Rina Pemohon' },
    }),
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    useTicketListSocket: () => ({ isConnected: true }),
}));

vi.mock('@/lib/socket', () => ({
    useSocket: () => ({
        socket: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        },
        isConnected: true,
    }),
}));

const listCalls = () =>
    vi.mocked(api.get).mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/tickets/paginated') && !url.includes('limit=1&') && !url.endsWith('limit=1'));

describe('BentoMyTicketsPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.mocked(api.get).mockClear();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
    });

    const renderPage = () =>
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/my-tickets']}>
                    <BentoMyTicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

    it('renders page header, stat cards, search, and ticket list', async () => {
        renderPage();

        // Wait for page to finish loading skeleton
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Tiket Saya' })).toBeInTheDocument();
        });

        expect(screen.getByText('Live')).toBeInTheDocument();

        // Stat cards & Filter buttons
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Dalam penanganan').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Selesai').length).toBeGreaterThan(0);

        // Wait for tickets to load (elements exist in both desktop and mobile view)
        await waitFor(() => {
            expect(screen.getAllByText('Komputer tidak bisa menyala').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Koneksi printer terputus').length).toBeGreaterThan(0);
        });

        // Unread chat badge
        expect(screen.getAllByText('Pesan baru').length).toBeGreaterThan(0);

        // Ticket number
        expect(screen.getAllByText('#190826-GEN-0001').length).toBeGreaterThan(0);
        expect(screen.getAllByText('#190826-GEN-0002').length).toBeGreaterThan(0);

        // Assignee
        expect(screen.getAllByText('Yudi Arta Trirensila').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Menunggu Teknisi').length).toBeGreaterThan(0);
    });

    it('shows the fetched per-status counts on the tinted stat cards', async () => {
        renderPage();
        const stats = await screen.findByRole('group', { name: 'Ringkasan tiket' });
        await waitFor(() => {
            expect(within(stats).getByRole('button', { name: /17\s*Total/ })).toBeInTheDocument();
        });
        expect(within(stats).getByRole('button', { name: /3\s*Open/ })).toBeInTheDocument();
        // Dalam penanganan = IN_PROGRESS + WAITING_VENDOR (mockup grouping)
        expect(within(stats).getByRole('button', { name: /6\s*Dalam penanganan/ })).toBeInTheDocument();
        // Selesai = RESOLVED + CLOSED
        expect(within(stats).getByRole('button', { name: /6\s*Selesai/ })).toBeInTheDocument();
        expect(within(stats).getByRole('button', { name: /17\s*Total/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps the search, status and page query parameters', async () => {
        const user = userEvent.setup();
        renderPage();
        await screen.findAllByText('Komputer tidak bisa menyala');

        const first = new URLSearchParams(listCalls()[0].split('?')[1]);
        expect(Object.fromEntries(first)).toEqual({ page: '1', limit: '10', sortBy: 'createdAt', sortOrder: 'DESC' });

        await user.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
        await waitFor(() => expect(listCalls().some((url) => url.includes('page=2&'))).toBe(true));

        const filters = screen.getByRole('group', { name: 'Filter status tiket' });
        await user.click(within(filters).getByRole('button', { name: 'Dalam penanganan' }));
        await user.type(screen.getByRole('searchbox'), 'printer');

        await waitFor(() => {
            const last = new URLSearchParams(listCalls().at(-1)!.split('?')[1]);
            expect(Object.fromEntries(last)).toEqual({
                page: '1', limit: '10', sortBy: 'createdAt', sortOrder: 'DESC', search: 'printer', status: 'IN_PROGRESS,WAITING_VENDOR',
            });
        });
        expect(within(filters).getByRole('button', { name: 'Dalam penanganan' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders status, priority and PIC as read-only pills, not buttons', async () => {
        const { container } = renderPage();
        await screen.findAllByText('Komputer tidak bisa menyala');

        expect(screen.getByText('Ditangani oleh')).toBeInTheDocument();
        const row = screen.getByRole('link', { name: /190826-GEN-0001/ });
        expect(within(row).queryByRole('button')).not.toBeInTheDocument();

        const pills = Array.from(row.querySelectorAll('.ticket-pill'));
        const texts = pills.map((pill) => pill.textContent);
        expect(texts).toEqual(expect.arrayContaining(['Open', 'Urgent', expect.stringMatching(/Yudi Arta Trirensila$/)]));
        pills.forEach((pill) => expect(pill.tagName).toBe('SPAN'));
        expect(container.querySelector('.ticket-pill.ticket-tone-sky')).not.toBeNull();
    });

    it('makes each row openable: accessible name, hint and Lihat detail / Lihat & balas', async () => {
        renderPage();
        await screen.findAllByText('Komputer tidak bisa menyala');

        expect(screen.getByText('Klik tiket untuk melihat percakapan, status terbaru, dan membalas petugas IT.')).toBeInTheDocument();
        const unread = screen.getByRole('link', { name: 'Buka tiket #190826-GEN-0001: Komputer tidak bisa menyala' });
        expect(unread).toHaveAttribute('href', '/client/tickets/t-1');
        // Desktop pill + mobile full-width button; decorative (the link carries the name).
        expect(within(unread).getAllByText('Lihat & balas')).toHaveLength(2);
        const read = screen.getByRole('link', { name: 'Buka tiket #190826-GEN-0002: Koneksi printer terputus' });
        expect(within(read).getAllByText('Lihat detail')).toHaveLength(2);
        expect(read.querySelector('.portal-open-cta.is-block')).not.toBeNull();
    });

    it('shows the mascot help banner linking to the client create route, without a response-time promise', async () => {
        renderPage();
        await screen.findAllByText('Komputer tidak bisa menyala');

        const banner = screen.getByRole('link', { name: /Ada kendala IT\?/ });
        expect(banner).toHaveAttribute('href', '/client/create');
        expect(banner).toHaveTextContent('Laporkan masalah komputer, printer, jaringan, atau aplikasi ke tim IT.');
        // Text link only: amber stays on the topbar CTA and the mobile FAB.
        expect(banner).toHaveTextContent('Buat tiket');
        expect(banner).not.toHaveTextContent('Buat Tiket Baru');
        expect(banner.querySelector('.idesk-cta')).toBeNull();
        expect(banner).not.toHaveTextContent(/segera|cepat|menit|jam/i);
        expect(banner.querySelector('img')).toHaveAttribute('src', '/characters/mascot-service.png');
    });
});
