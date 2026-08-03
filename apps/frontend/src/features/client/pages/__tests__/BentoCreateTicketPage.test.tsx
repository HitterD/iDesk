import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import { BentoCreateTicketPage } from '../BentoCreateTicketPage';

const mockPageAccess = {
    lost_items: false,
    hardware_requests: false,
    tickets: true,
    eform_access: true,
};

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url === '/settings/scheduling') return Promise.resolve({ data: { hardwareTypes: [], timeSlots: [] } });
            if (url === '/sla-config') return Promise.resolve({ data: [] });
            if (url === '/ticket-attributes') return Promise.resolve({ data: { categories: [], devices: [], software: [] } });
            return Promise.resolve({ data: {} });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({
        data: {
            pageAccess: mockPageAccess,
        },
    }),
}));

vi.mock('../../../stores/useAuth', () => ({
    useAuth: () => ({
        user: { role: 'USER', fullName: 'Test User' },
    }),
}));

describe('BentoCreateTicketPage Permissions Filtering', () => {
    it('hides Lost Items and Hardware & Budget cards when user lacks pageAccess', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/create']}>
                    <BentoCreateTicketPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Service Ticket heading should be visible
        expect(screen.getByRole('heading', { name: 'Service Ticket' })).toBeInTheDocument();

        // Access Request heading should be visible
        expect(screen.getByRole('heading', { name: 'Access Request' })).toBeInTheDocument();

        // Lost Item Report and Hardware & Budget cards should NOT be rendered
        expect(screen.queryByText('Lost Item Report')).not.toBeInTheDocument();
        expect(screen.queryByText('Hardware & Budget')).not.toBeInTheDocument();
    });

    it('falls back to request types for an unknown type query parameter', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/create?type=unexpected']}>
                    <BentoCreateTicketPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(screen.getByRole('heading', { name: 'Buat Tiket Baru' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Service Ticket' })).toBeInTheDocument();
    });
});
