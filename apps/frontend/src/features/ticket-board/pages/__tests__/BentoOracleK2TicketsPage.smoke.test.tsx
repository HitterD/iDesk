import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import { BentoOracleK2TicketsPage } from '../BentoOracleK2TicketsPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/features/ticket-board/hooks/useOracleK2Tickets', () => ({
    useOracleK2Tickets: () => ({
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
    }),
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { role: 'AGENT_ORACLE', fullName: 'Oracle Agent' },
        isAuthenticated: true,
    }),
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    useTicketListSocket: vi.fn(),
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
        expect(screen.getByText('New Oracle/K2 Request')).toBeInTheDocument();
    });
});
