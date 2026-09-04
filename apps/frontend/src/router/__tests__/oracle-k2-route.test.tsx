import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AppRoutes from '../../routes/AppRoutes';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

let mockPageAccess: Record<string, boolean> = {
    oracle_k2_tickets: true,
    notifications: true,
};

vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({
        data: {
            pageAccess: mockPageAccess,
        },
    }),
    useHasPermission: () => ({
        hasPermission: true,
        isLoading: false,
    }),
    useHasPageAccess: (key: string) => ({
        hasAccess: !!mockPageAccess[key],
        isLoading: false,
        isSystemAdmin: false,
    }),
}));

let mockUser = {
    id: 'user-oracle-1',
    role: 'AGENT_ORACLE',
    fullName: 'Oracle Agent',
    email: 'oracle@idesk.local',
};

vi.mock('@/stores/useAuth', () => ({
    useAuth: (selector?: any) => {
        const state = {
            user: mockUser,
            isAuthenticated: true,
            isSessionExpired: () => false,
            logout: vi.fn(),
        };
        return selector ? selector(state) : state;
    },
}));

// Helper component to track current pathname in MemoryRouter
const LocationDisplay = () => {
    const location = useLocation();
    return <div data-testid="location-display">{location.pathname}</div>;
};

describe('Oracle K2 Route & Redirection Access', () => {
    beforeEach(() => {
        mockPageAccess = {
            oracle_k2_tickets: true,
            notifications: true,
        };
        mockUser = {
            id: 'user-oracle-1',
            role: 'AGENT_ORACLE',
            fullName: 'Oracle Agent',
            email: 'oracle@idesk.local',
        };
    });

    it('allows AGENT_ORACLE to access /tickets/oracle-k2', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/tickets/oracle-k2']}>
                    <LocationDisplay />
                    <AppRoutes />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(screen.queryByText(/Unauthorized/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('location-display')).toHaveTextContent('/tickets/oracle-k2');
    });

    it('redirects AGENT_ORACLE from root (/) to /tickets/oracle-k2', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/']}>
                    <LocationDisplay />
                    <AppRoutes />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('location-display')).toHaveTextContent('/tickets/oracle-k2');
        }, { timeout: 4000 });
    });

    it('redirects AGENT_ORACLE from /dashboard to /tickets/oracle-k2', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/dashboard']}>
                    <LocationDisplay />
                    <AppRoutes />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('location-display')).toHaveTextContent('/tickets/oracle-k2');
        }, { timeout: 4000 });
    });

    it('redirects AGENT_ORACLE from /tickets/list to /tickets/oracle-k2', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/tickets/list']}>
                    <LocationDisplay />
                    <AppRoutes />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('location-display')).toHaveTextContent('/tickets/oracle-k2');
        }, { timeout: 4000 });
    });

    it('redirects AGENT_ORACLE from /kanban to /tickets/oracle-k2', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/kanban']}>
                    <LocationDisplay />
                    <AppRoutes />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('location-display')).toHaveTextContent('/tickets/oracle-k2');
        }, { timeout: 4000 });
    });
});
