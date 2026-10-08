import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useSessionRestore } from '../../hooks/useSessionRestore';
import { useAuth } from '../../stores/useAuth';
import api from '../../lib/api';

vi.mock('../../lib/api', () => {
    const post = vi.fn();
    return { default: { post, get: vi.fn() }, refreshSession: () => post('/auth/refresh') };
});
vi.mock('@/hooks/usePermissions', () => ({
    useHasPermission: () => ({ hasPermission: true, isLoading: false }),
    useHasPageAccess: () => ({ hasAccess: true, isLoading: false }),
}));
function Bootstrap() {
    const { isRestoring } = useSessionRestore();
    if (isRestoring) return <p>Memulihkan sesi</p>;
    return <Routes><Route path="/dashboard" element={<ProtectedRoute><p>Dashboard siap</p></ProtectedRoute>} /><Route path="/login" element={<p>Login</p>} /></Routes>;
}
beforeEach(() => {
    useAuth.getState().logout();
    vi.clearAllMocks();
});
describe('protected route bootstrap', () => {
    it('waits for cookie restoration before deciding to redirect', async () => {
        let resolve!: (value: unknown) => void;
        vi.mocked(api.post).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
        render(<MemoryRouter initialEntries={['/dashboard']}><Bootstrap /></MemoryRouter>);
        expect(screen.getByText('Memulihkan sesi')).toBeInTheDocument();
        expect(screen.queryByText('Login')).not.toBeInTheDocument();
        resolve({ data: { user: { id: 'one', email: 'one@idesk.com', fullName: 'One', role: 'ADMIN' }, expiresAt: '2030-01-01T00:00:00.000Z' } });
        expect(await screen.findByText('Dashboard siap')).toBeInTheDocument();
    });
    it('shows retry after transient bootstrap failure and restores the cookie session on retry', async () => {
        vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } });
        render(<MemoryRouter initialEntries={['/dashboard']}><Bootstrap /></MemoryRouter>);
        expect(await screen.findByRole('alert')).toHaveTextContent('Pemulihan sesi gagal sementara');
        vi.mocked(api.post).mockResolvedValueOnce({ data: { user: { id: 'one', email: 'one@idesk.com', fullName: 'One', role: 'ADMIN' } } });
        await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
        await waitFor(() => expect(screen.getByText('Dashboard siap')).toBeInTheDocument());
    });
});
