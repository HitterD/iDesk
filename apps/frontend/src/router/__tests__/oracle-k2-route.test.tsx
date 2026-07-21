import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect } from 'vitest';
import AppRoutes from '../../routes/AppRoutes';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/hooks/usePermissions', () => ({
    useMyPermissions: () => ({
        data: {
            pageAccess: {
                oracle_k2_tickets: true,
                notifications: true,
            },
        },
    }),
    useHasPermission: () => ({
        hasPermission: true,
        isLoading: false,
    }),
    useHasPageAccess: () => ({
        hasAccess: true,
        isLoading: false,
        isSystemAdmin: false,
    }),
}));

vi.mock('@/stores/authStore', () => ({
    useAuthStore: () => ({
        user: { role: 'AGENT_ORACLE', fullName: 'Oracle Agent' },
        isAuthenticated: true,
    }),
}));

describe('Oracle K2 Route Access', () => {
    it('allows AGENT_ORACLE to access /tickets/oracle-k2', async () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={qc}>
                <MemoryRouter initialEntries={['/tickets/oracle-k2']}>
                    <AppRoutes />
                </MemoryRouter>
            </QueryClientProvider>
        );

        // Does not redirect to unauthorized
        expect(screen.queryByText(/Unauthorized/i)).not.toBeInTheDocument();
    });
});
