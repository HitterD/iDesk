import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionRestore, restoreSession } from '../useSessionRestore';
import { useAuth } from '../../stores/useAuth';
import api from '../../lib/api';

vi.mock('../../lib/api', () => ({
    default: {
        post: vi.fn(),
        resetLoginRedirectState: vi.fn(),
    },
}));

describe('useSessionRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.setState({
            user: null,
            isAuthenticated: false,
            expiresAt: null,
        });
    });

    it('silently restores session via /auth/refresh when not authenticated', async () => {
        const mockUser = { id: 'u1', email: 'user@idesk.com', fullName: 'User One', role: 'USER' };
        vi.mocked(api.post).mockResolvedValueOnce({
            data: {
                user: mockUser,
                expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            },
        });

        const { result } = renderHook(() => useSessionRestore());

        expect(result.current.isRestoring).toBe(true);

        await waitFor(() => {
            expect(result.current.isRestoring).toBe(false);
        });

        expect(api.post).toHaveBeenCalledWith('/auth/refresh');
        expect(useAuth.getState().isAuthenticated).toBe(true);
        expect(useAuth.getState().user).toEqual(mockUser);
    });

    it('does not attempt restore when user is already validly authenticated', async () => {
        const validUser = { id: 'u2', email: 'admin@idesk.com', fullName: 'Admin', role: 'ADMIN' };
        useAuth.setState({
            user: validUser,
            isAuthenticated: true,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        });

        const { result } = renderHook(() => useSessionRestore());

        expect(result.current.isRestoring).toBe(false);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('completes isRestoring as false when /auth/refresh fails', async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
            response: { status: 401, data: { message: 'Unauthorized' } },
        });

        const { result } = renderHook(() => useSessionRestore());

        await waitFor(() => {
            expect(result.current.isRestoring).toBe(false);
        });

        expect(useAuth.getState().isAuthenticated).toBe(false);
    });
});
