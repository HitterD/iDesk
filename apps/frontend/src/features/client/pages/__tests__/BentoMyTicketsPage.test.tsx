import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.includes('/tickets/paginated')) {
                return Promise.resolve({
                    data: {
                        data: mockTickets,
                        meta: {
                            total: 2,
                            page: 1,
                            limit: 10,
                            totalPages: 1,
                            hasNextPage: false,
                            hasPrevPage: false,
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
        user: { id: 'u-1', role: 'USER', fullName: 'User SPJ' },
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

describe('BentoMyTicketsPage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });
    });

    it('renders page header, stat cards, search, and ticket list', async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/my-tickets']}>
                    <BentoMyTicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Wait for page to finish loading skeleton
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'My Tickets' })).toBeInTheDocument();
        });

        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /New Ticket/i })).toBeInTheDocument();

        // Stat cards & Filter buttons
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);

        // Wait for tickets to load (elements exist in both desktop and mobile view)
        await waitFor(() => {
            expect(screen.getAllByText('Komputer tidak bisa menyala').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Koneksi printer terputus').length).toBeGreaterThan(0);
        });

        // Unread chat badge
        expect(screen.getAllByText('Balasan Baru').length).toBeGreaterThan(0);

        // Ticket number
        expect(screen.getAllByText('#190826-GEN-0001').length).toBeGreaterThan(0);
        expect(screen.getAllByText('#190826-GEN-0002').length).toBeGreaterThan(0);

        // Assignee
        expect(screen.getAllByText('Yudi Arta Trirensila').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Menunggu Teknisi').length).toBeGreaterThan(0);
    });
});
