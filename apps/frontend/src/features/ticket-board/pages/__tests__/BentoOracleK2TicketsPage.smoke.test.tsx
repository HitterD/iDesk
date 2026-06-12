import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import api from '@/lib/api';
import { BentoOracleK2TicketsPage } from '../BentoOracleK2TicketsPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.startsWith('/tickets/paginated/oracle')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 't-1',
                                ticketNumber: '010126-GEN-0001',
                                title: 'Oracle DB provisioning',
                                status: 'TODO',
                                priority: 'HIGH',
                                category: 'ORACLE_REQUEST',
                                createdAt: '2026-06-12T08:00:00Z',
                            },
                        ],
                        meta: { total: 1, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        }),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/hooks/useTicketSocket', () => ({
    useTicketListSocket: vi.fn(),
}));

const renderPage = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <MemoryRouter>
            <QueryClientProvider client={qc}>
                <BentoOracleK2TicketsPage />
            </QueryClientProvider>
        </MemoryRouter>
    );
};

describe('BentoOracleK2TicketsPage (smoke)', () => {
    it('renders page header "Oracle K2 Request"', async () => {
        renderPage();
        expect(await screen.findByText('Oracle K2 Request')).toBeInTheDocument();
    });

    it('calls /tickets/paginated/oracle', async () => {
        renderPage();
        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith(
                '/tickets/paginated/oracle',
                expect.objectContaining({ params: expect.any(Object) })
            );
        });
    });

    it('renders the ticket list when data loads', async () => {
        renderPage();
        expect(await screen.findByText('Oracle DB provisioning')).toBeInTheDocument();
    });
});
