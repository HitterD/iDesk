import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '../../../stores/useAuth';

/** Page keys the mocked preset grants; null = everything. */
const pageAccess = vi.hoisted(() => ({ allowed: null as Set<string> | null }));

vi.mock('@/hooks/usePermissions', () => ({
    useHasPermission: () => ({ hasPermission: true, isLoading: false }),
    useHasPageAccess: (key: string) => ({ hasAccess: !pageAccess.allowed || pageAccess.allowed.has(key), isLoading: false, isError: false }),
}));

describe('ProtectedRoute', () => {
    beforeEach(() => {
        pageAccess.allowed = null;
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

    it('passes the requested page as ?next= so a deep link (e.g. from iPop) lands there after login', () => {
        const LoginProbe = () => <div>{useLocation().search}</div>;
        render(
            <MemoryRouter initialEntries={['/client/tickets/abc?tab=chat']}>
                <Routes>
                    <Route path="/client/tickets/:id" element={<ProtectedRoute><div>Ticket</div></ProtectedRoute>} />
                    <Route path="/login" element={<LoginProbe />} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText(`?next=${encodeURIComponent('/client/tickets/abc?tab=chat')}`)).toBeInTheDocument();
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
    const loginAs = (role: string) => useAuth.setState({
        user: { id: 'u1', email: 'a@idesk.com', fullName: 'A', role },
        isAuthenticated: true,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    const renderPageAccessRoute = (start: string) => render(
        <MemoryRouter initialEntries={[start]}>
            <Routes>
                <Route path="/dashboard" element={<ProtectedRoute requiredPageAccess="dashboard"><div>Team Dashboard</div></ProtectedRoute>} />
                <Route path="/dashboard/me" element={<ProtectedRoute requiredPageAccess="my_dashboard"><div>My Dashboard</div></ProtectedRoute>} />
                <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
            </Routes>
        </MemoryRouter>
    );

    it('sends a developer agent denied the team dashboard to their own dashboard, not /dashboard', () => {
        loginAs('AGENT_WEB_DEV');
        pageAccess.allowed = new Set(['my_dashboard']);
        renderPageAccessRoute('/dashboard');
        expect(screen.getByText('My Dashboard')).toBeInTheDocument();
    });

    it('does not loop when the denied page is the role home', () => {
        loginAs('AGENT_MOBILE_DEV');
        pageAccess.allowed = new Set();
        renderPageAccessRoute('/dashboard/me');
        expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
    });
});
