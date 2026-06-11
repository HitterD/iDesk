import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { BentoAdminAgentsPage } from '../BentoAdminAgentsPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url.startsWith('/users/agents/stats')) return Promise.resolve({ data: { summary: {}, agents: [] } });
            if (url.startsWith('/sites/active')) return Promise.resolve({ data: [] });
            if (url.startsWith('/departments')) return Promise.resolve({ data: [] });
            if (url.startsWith('/permissions')) return Promise.resolve({ data: [] });
            if (url.startsWith('/users')) return Promise.resolve({ data: { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false } } });
            return Promise.resolve({ data: {} });
        }),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        patch: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({ user: { id: 'admin-1', role: 'ADMIN', siteId: null } }),
}));

vi.mock('../../components/OnboardingTutorial', () => ({
    OnboardingTutorial: () => null,
    shouldShowOnboarding: () => false,
}));

describe('BentoAdminAgentsPage (characterization)', () => {
    const renderPage = () => {
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        return render(
            <QueryClientProvider client={qc}>
                <BentoAdminAgentsPage />
            </QueryClientProvider>
        );
    };

    it('renders header and primary actions', async () => {
        renderPage();
        expect(await screen.findByText('Agent Management')).toBeInTheDocument();
        expect(screen.getByText('Add User')).toBeInTheDocument();
    });

    it('renders stat cards', async () => {
        renderPage();
        expect(await screen.findByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('Active (In Progress)')).toBeInTheDocument();
        expect(screen.getByText('Resolved (Month)')).toBeInTheDocument();
    });

    it('renders empty state when no users', async () => {
        renderPage();
        expect(await screen.findByText('No Users Found')).toBeInTheDocument();
    });
});
