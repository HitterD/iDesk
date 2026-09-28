import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import { BentoCreateTicketPage } from '../BentoCreateTicketPage';

const mockPageAccess = {
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
    it('hides Hardware & Budget card when user lacks pageAccess and never shows Lost Item Report', () => {
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

        // Lost Item feature was removed; Hardware & Budget is hidden by pageAccess
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

    it('renders both Ticketing and Requests sections with character mascots', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/create']}>
                    <BentoCreateTicketPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Section headings
        expect(screen.getByRole('heading', { name: /tiket bantuan & kendala teknis/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /pengajuan layanan & akses/i })).toBeInTheDocument();

        // Character mascots for visible cards
        expect(screen.getByAltText('Maskot IT Support Agent')).toBeInTheDocument();
        expect(screen.getByAltText('Maskot Oracle & K2')).toBeInTheDocument();
        expect(screen.getByAltText('Maskot Web Developer')).toBeInTheDocument();
        expect(screen.getByAltText('Maskot Mobile Developer')).toBeInTheDocument();
        expect(screen.getByAltText('Maskot Izin Akses')).toBeInTheDocument();
    });

    it('shows no error banner while a valid title is typed', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/client/create?type=service']}>
                    <BentoCreateTicketPage />
                </MemoryRouter>
            </QueryClientProvider>
        );

        const title = document.getElementById('service-ticket-title') as HTMLInputElement;
        fireEvent.change(title, { target: { value: 'jar' } });
        expect(screen.getAllByText('Judul tiket minimal 5 karakter').length).toBeGreaterThan(0);

        fireEvent.change(title, { target: { value: 'jaringan error' } });
        expect(screen.queryByText('Mohon perbaiki isian yang ditandai.')).not.toBeInTheDocument();
        expect(screen.queryByText('Judul tiket minimal 5 karakter')).not.toBeInTheDocument();
    });
});
