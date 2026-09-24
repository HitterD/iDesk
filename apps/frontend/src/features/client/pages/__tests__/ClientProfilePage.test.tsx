import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientProfilePage } from '../ClientProfilePage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn((url: string) => {
            if (url === '/users/me') {
                return Promise.resolve({
                    data: {
                        id: 'user-1',
                        email: 'user.spj@idesk.com',
                        fullName: 'User SPJ',
                        phoneNumber: '+628123456789',
                        jobTitle: 'Software Engineer',
                    },
                });
            }
            return Promise.resolve({ data: {} });
        }),
        patch: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: {
            id: 'user-1',
            email: 'user.spj@idesk.com',
            fullName: 'User SPJ',
        },
        updateUser: vi.fn(),
    }),
}));

vi.mock('@/components/theme-provider', () => ({
    useTheme: () => ({
        theme: 'light',
        setTheme: vi.fn(),
    }),
}));

describe('ClientProfilePage', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
    });

    const renderWithRouter = (initialRoute = '/client/profile') => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[initialRoute]}>
                    <ClientProfilePage />
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('does not render Telegram tab in navigation', () => {
        renderWithRouter();

        expect(screen.queryByRole('button', { name: /telegram/i })).not.toBeInTheDocument();

        expect(screen.getByRole('button', { name: /^profile$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^notifikasi$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^password$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^appearance$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^suara notifikasi$/i })).toBeInTheDocument();
    });

    it('falls back to profile tab when query parameter ?tab=telegram is accessed', () => {
        renderWithRouter('/client/profile?tab=telegram');

        expect(screen.queryByRole('button', { name: /telegram/i })).not.toBeInTheDocument();
        expect(screen.getByText('Full Name')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
});
