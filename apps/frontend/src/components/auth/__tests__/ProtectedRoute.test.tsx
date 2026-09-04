import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '../../../stores/useAuth';

vi.mock('@/hooks/usePermissions', () => ({
    useHasPermission: () => ({ hasPermission: true, isLoading: false }),
    useHasPageAccess: () => ({ hasAccess: true, isLoading: false, isError: false }),
}));

describe('ProtectedRoute', () => {
    beforeEach(() => {
        useAuth.setState({
            user: null,
            isAuthenticated: false,
            expiresAt: null,
        });
    });

    it('redirects to /login when user is not authenticated', () => {
        render(
            <MemoryRouter initialEntries={['/protected']}>
                <Routes>
                    <Route
                        path="/protected"
                        element={
                            <ProtectedRoute>
                                <div>Protected Content</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/login" element={<div>Login Page</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('renders children when user is authenticated with allowed role', () => {
        useAuth.setState({
            user: { id: 'u1', email: 'user@idesk.com', fullName: 'User 1', role: 'USER' },
            isAuthenticated: true,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        });

        render(
            <MemoryRouter initialEntries={['/client/tickets']}>
                <Routes>
                    <Route
                        path="/client/tickets"
                        element={
                            <ProtectedRoute allowedRoles={['USER']}>
                                <div>Client Tickets Content</div>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('Client Tickets Content')).toBeInTheDocument();
    });

    it('does not prematurely log out user when token expiry timestamp is reached', () => {
        // Simulates browser reopened after access token expiry (e.g. 2 hours later)
        // System should allow rendering so background refresh can restore token seamlessly
        useAuth.setState({
            user: { id: 'u1', email: 'user@idesk.com', fullName: 'User 1', role: 'USER' },
            isAuthenticated: true,
            expiresAt: new Date(Date.now() - 3600_000).toISOString(), // in the past
        });

        render(
            <MemoryRouter initialEntries={['/client/tickets']}>
                <Routes>
                    <Route
                        path="/client/tickets"
                        element={
                            <ProtectedRoute allowedRoles={['USER']}>
                                <div>Client Tickets Content</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/login" element={<div>Login Page</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('Client Tickets Content')).toBeInTheDocument();
        expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
        expect(useAuth.getState().isAuthenticated).toBe(true);
    });

    it('redirects to /unauthorized when user role is not allowed', () => {
        useAuth.setState({
            user: { id: 'u1', email: 'user@idesk.com', fullName: 'User 1', role: 'USER' },
            isAuthenticated: true,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        });

        render(
            <MemoryRouter initialEntries={['/admin/only']}>
                <Routes>
                    <Route
                        path="/admin/only"
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <div>Admin Secret</div>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
        expect(screen.queryByText('Admin Secret')).not.toBeInTheDocument();
    });
});
