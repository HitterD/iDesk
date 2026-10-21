import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientTicketDetailPage } from '../ClientTicketDetailPage';

const mockTicket = {
    id: 'ticket-123',
    ticketNumber: '190826-GEN-0005',
    title: 'Password terkunci',
    description: 'Gagal login berkali-kali. Mohon dibantu reset.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'HARDWARE',
    device: 'Laptop',
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
    slaTarget: '2026-08-30T10:00:00.000Z',
    user: {
        id: 'user-1',
        fullName: 'User SPJ',
        email: 'user.spj@desk.com',
    },
    assignedTo: {
        id: 'agent-1',
        fullName: 'Yudi Arta Trirensila',
        email: 'yudi.arta@kapalapi.co.id',
        site: {
            id: 'site-1',
            name: 'Site SPJ',
            code: 'SPJ',
        },
    },
    messages: [
        {
            id: 'm-1',
            content: 'Gagal login berkali-kali. Mohon dibantu reset.',
            createdAt: '2026-08-19T08:00:00.000Z',
            isSystemMessage: false,
            sender: {
                id: 'user-1',
                fullName: 'User SPJ',
            },
        },
    ],
};

// Per-test status override; the base fixture stays immutable.
let currentStatus = mockTicket.status;
let extraFields: Record<string, unknown> = {};

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url === '/tickets/ticket-123') {
                return Promise.resolve({
                    data: {
                        ...mockTicket,
                        status: currentStatus,
                        ...extraFields,
                        resolutionDeadlineAt: '2026-08-20T10:00:00.000Z',
                    },
                });
            }
            if (url === '/tickets/ticket-123/agent-ratings') {
                return Promise.resolve({
                    data: {
                        canRate: true,
                        ratingDeadline: '2026-08-27T10:00:00.000Z',
                        agents: [{ agentId: 'agent-1', fullName: 'Yudi Arta Trirensila', rating: null, comment: null }],
                    },
                });
            }
            return Promise.resolve({ data: {} });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'USER', fullName: 'User SPJ' },
    }),
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    TICKET_OFFLINE_POLL_MS: 15000,
    useTicketSocket: () => ({
        isConnected: true,
        typingUsers: {},
        sendTypingStart: vi.fn(),
        sendTypingStop: vi.fn(),
    }),
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

describe('ClientTicketDetailPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        currentStatus = mockTicket.status;
        extraFields = {};
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
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
                <MemoryRouter initialEntries={['/client/tickets/ticket-123']}>
                    <Routes>
                        <Route path="/client/tickets/:id" element={<ClientTicketDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

    it('shows "Masalah sudah selesai" as the requester primary action on an open ticket', async () => {
        renderPage();
        const primary = await screen.findByRole('button', { name: 'Masalah sudah selesai' });
        expect(primary).toHaveClass('idesk-btn', 'is-primary');
        expect(screen.getAllByRole('button', { name: /Batalkan/ }).length).toBeGreaterThan(0);
        expect(screen.queryByRole('region', { name: 'Konfirmasi penyelesaian tiket' })).not.toBeInTheDocument();
    });

    it('shows the confirmation banner on a RESOLVED ticket', async () => {
        currentStatus = 'RESOLVED';
        renderPage();
        expect(await screen.findByRole('region', { name: 'Konfirmasi penyelesaian tiket' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ya, sudah selesai' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Masih bermasalah' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Masalah sudah selesai' })).not.toBeInTheDocument();
    });

    it('locks a CLOSED ticket: no chat input, no cancel, rating form shown', async () => {
        currentStatus = 'CLOSED';
        renderPage();
        expect(await screen.findByText('Tiket sudah ditutup. Buat tiket baru jika masih ada kendala.')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Balas ke IT Support…')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Batalkan/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Masalah sudah selesai' })).not.toBeInTheDocument();
        expect(await screen.findByText('Beri Penilaian Layanan')).toBeInTheDocument();
    });

    it('renders ticket header with badges, full chat room, and Bento properties sidebar', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/tickets/ticket-123']}>
                    <Routes>
                        <Route path="/client/tickets/:id" element={<ClientTicketDetailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Wait for ticket to load
        await waitFor(() => {
            expect(screen.getAllByRole('heading', { name: 'Password terkunci' }).length).toBeGreaterThan(0);
        });

        // Header Badges & Actions
        expect(screen.getByText('#190826-GEN-0005')).toBeInTheDocument();
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Normal').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Hardware').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Batalkan').length).toBeGreaterThan(0);

        // Tabs
        expect(screen.getByRole('button', { name: 'Percakapan' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Aktivitas' })).toBeInTheDocument();

        // Chat genesis report & messages
        expect(screen.getByText('Laporan awal')).toBeInTheDocument();
        expect(screen.getAllByText(/Gagal login berkali-kali/i).length).toBeGreaterThan(0);

        // Assigned Agent in Bento Sidebar
        expect(screen.getByText('Yudi Arta Trirensila')).toBeInTheDocument();
        expect(screen.getByText('IT Support Specialist · Site SPJ')).toBeInTheDocument();
        expect(screen.getByText('yudi.arta@kapalapi.co.id')).toBeInTheDocument();

        // Bento Ticket Properties & Participants
        expect(screen.getByText('Ditangani oleh')).toBeInTheDocument();
        expect(screen.getByText('Anggota tiket')).toBeInTheDocument();
        expect(screen.getByText('Detail tiket')).toBeInTheDocument();
        expect(screen.getByText('Perkiraan waktu')).toBeInTheDocument();
        // Requester never gets agent actions.
        for (const name of ['Resolve', 'Teruskan', 'Perpanjang SLA', 'Set Reminder', 'Internal Note']) {
            expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
        }
    });

    it('shows plain readonly badges to the requester with no editors or internal-note controls', async () => {
        renderPage();
        await screen.findAllByRole('heading', { name: 'Password terkunci' });
        const inspector = screen.getAllByRole('complementary', { name: 'Info tiket' })[0];
        expect(within(inspector).getByText('In Progress').closest('.ticket-pill')).toBeInTheDocument();
        expect(within(inspector).getByText('Normal').closest('.ticket-pill')).toBeInTheDocument();
        expect(document.querySelector('.picker-trigger')).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Internal Note' })).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Balas ke IT Support…' })).toBeInTheDocument();
    });

    it('keeps readonly status/SLA/priority bubbles in the requester header', async () => {
        renderPage();
        await screen.findAllByRole('heading', { name: 'Password terkunci' });
        const header = document.querySelector('header') as HTMLElement;
        expect(within(header).getByRole('button', { name: /Salin nomor tiket/ })).toHaveTextContent('#190826-GEN-0005');
        expect(within(header).getByText('In Progress').closest('.ticket-pill')).toBeInTheDocument();
        expect(within(header).getByText('Normal').closest('.ticket-pill')).toBeInTheDocument();
        expect(header.querySelector('.picker-trigger')).not.toBeInTheDocument();
    });

    it('shows a paused ticket as "Menunggu vendor" with pause date and no target date', async () => {
        currentStatus = 'WAITING_VENDOR';
        extraFields = { slaRemainingMinutes: 320, lastPausedAt: '2026-08-19T09:00:00.000Z' };
        renderPage();
        await screen.findAllByRole('heading', { name: 'Password terkunci' });
        const inspector = screen.getAllByRole('complementary', { name: 'Info tiket' })[0];
        expect(within(inspector).getByText('Menunggu vendor')).toBeInTheDocument();
        expect(within(inspector).getByText('Dijeda sejak')).toBeInTheDocument();
        expect(within(inspector).queryByText('Target SLA')).not.toBeInTheDocument();
    });
});
