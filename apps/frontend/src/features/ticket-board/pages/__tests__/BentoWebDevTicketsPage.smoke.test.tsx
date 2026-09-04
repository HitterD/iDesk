import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import { BentoWebDevTicketsPage } from '../BentoWebDevTicketsPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/features/ticket-board/hooks/useWebDevTickets', () => ({
    useWebDevTickets: () => ({
        data: {
            data: [
                {
                    id: 'web-1',
                    ticketNumber: 'W-101',
                    title: 'Web Portal Bug',
                    description: 'Button not clickable',
                    status: 'TODO',
                    priority: 'HIGH',
                    category: 'WEB_DEV_REQUEST',
                    createdAt: '2026-08-31T00:00:00Z',
                    updatedAt: '2026-08-31T00:00:00Z',
                    user: { id: 'u-1', fullName: 'Alice Developer', email: 'alice@example.com' },
                },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
    }),
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

describe('BentoWebDevTicketsPage', () => {
    it('renders Web Developer Request page header and action buttons', () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter>
                    <BentoWebDevTicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(screen.getByText('Web Developer Request')).toBeInTheDocument();
        expect(screen.getByText('New Web Dev Request')).toBeInTheDocument();
        expect(screen.getByTitle('Kanban Board')).toBeInTheDocument();
    });

    it('renders Kanban board when ?view=kanban query param is set', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/tickets/web-developer?view=kanban']}>
                    <BentoWebDevTicketsPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(await screen.findByText('Web Developer Kanban')).toBeInTheDocument();
    });
});
