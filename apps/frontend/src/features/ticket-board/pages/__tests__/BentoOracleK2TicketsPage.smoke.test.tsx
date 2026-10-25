import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import api from '@/lib/api';
import { BentoOracleK2TicketsPage } from '../BentoOracleK2TicketsPage';

const useOracleK2TicketsSpy = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/features/ticket-board/hooks/useOracleK2Tickets', () => ({
    useOracleK2Tickets: (params: unknown) => {
        useOracleK2TicketsSpy(params);
        return ({
        data: {
            data: [
                {
                    id: 'ora-1',
                    ticketNumber: 'T-100',
                    title: 'Oracle Bug',
                    description: 'Oracle issue',
                    status: 'TODO',
                    priority: 'MEDIUM',
                    category: 'Oracle',
                    createdAt: '2026-07-21T00:00:00Z',
                    updatedAt: '2026-07-21T00:00:00Z',
                    user: { id: 'u-1', fullName: 'John Doe', email: 'john@example.com' },
                },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
    });
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { role: 'AGENT_ORACLE', fullName: 'Oracle Agent' },
        isAuthenticated: true,
    }),
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    useTicketListSocket: vi.fn(() => ({ isConnected: true })),
}));

describe('BentoOracleK2TicketsPage', () => {
    it('renders Oracle/K2 tickets page header and stats correctly', () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <BentoOracleK2TicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(screen.getByText('Oracle K2 Request')).toBeInTheDocument();
        // Single CTA: create lives in the topbar / mobile FAB, never in the queue header.
        expect(screen.queryByRole('button', { name: 'Buat Tiket Baru' })).not.toBeInTheDocument();
        expect(screen.queryByText(/berdasarkan halaman yang dimuat/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Semua' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTitle('Kanban Board')).toBeInTheDocument();
    });

    it('renders Kanban board when ?view=kanban query param is set', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/tickets/oracle-k2?view=kanban']}>
                    <BentoOracleK2TicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(await screen.findByRole('region', { name: 'Kanban tiket' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Tampilan Kanban' })).toHaveAttribute('aria-current', 'page');
    });
    it('"Saya Buat" asks the server for my tickets in this queue', () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <BentoOracleK2TicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        const button = screen.getByRole('button', { name: /Saya Buat/ });
        expect(button).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(useOracleK2TicketsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ createdByMe: true, assignedToMe: false }));
    });

    it('"Tugas Saya" is filtered on the server', () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/?filter=assigned_to_me']}>
                    <BentoOracleK2TicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(useOracleK2TicketsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ assignedToMe: true, createdByMe: false }));
    });

    it('shows counts for the whole queue from the server and filters the list there', async () => {
        vi.mocked(api.get).mockImplementation(async (url: string) => ({
            data: url.startsWith('/tickets/queue-stats')
                ? { total: 40, open: 7, inProgress: 21, waitingVendor: 3, resolved: 9, overdue: 12, critical: 2 }
                : [],
        }));
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <BentoOracleK2TicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/tickets/queue-stats?queue=oracle'));
        // Card numbers count up (StatsCard animation); wait for the final value.
        expect(await screen.findByText('21', {}, { timeout: 3000 })).toBeInTheDocument();

        fireEvent.click(screen.getByText('Waiting Vendor'));
        expect(useOracleK2TicketsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'WAITING_VENDOR' }));
        fireEvent.click(screen.getByText('Resolved'));
        expect(useOracleK2TicketsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'RESOLVED,CLOSED' }));
    });
});
