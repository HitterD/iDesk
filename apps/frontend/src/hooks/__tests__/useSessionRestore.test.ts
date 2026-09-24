import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionRestore, restoreSession, _resetRestorePromiseForTest } from '../useSessionRestore';
import { useAuth } from '../../stores/useAuth';
import api from '../../lib/api';

vi.mock('../../lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        resetLoginRedirectState: vi.fn(),
    },
}));

describe('useSessionRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetRestorePromiseForTest();
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

    it('syncs user if backend cookie returns different user via /users/me', async () => {
        const localUser = { id: 'admin-1', email: 'admin@idesk.com', fullName: 'Admin', role: 'ADMIN' as const };
        const cookieUser = { id: 'user-2', email: 'user.spj@idesk.com', fullName: 'User SPJ', role: 'USER' as const };
        useAuth.setState({
            user: localUser,
            isAuthenticated: true,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        });

        vi.mocked(api.get).mockResolvedValueOnce({
            data: cookieUser,
        });

        const res = await restoreSession();
        expect(res).toBe(true);
        expect(useAuth.getState().user).toEqual(cookieUser);
    });

    it('attempts /auth/refresh when /users/me returns 401', async () => {
        const localUser = { id: 'admin-1', email: 'admin@idesk.com', fullName: 'Admin', role: 'ADMIN' as const };
        const refreshedUser = { id: 'admin-1', email: 'admin@idesk.com', fullName: 'Admin', role: 'ADMIN' as const };
        useAuth.setState({
            user: localUser,
            isAuthenticated: true,
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        });

        vi.mocked(api.get).mockRejectedValueOnce({
            response: { status: 401, data: { message: 'Unauthorized' } },
        });
        vi.mocked(api.post).mockResolvedValueOnce({
            data: {
                user: refreshedUser,
                expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            },
        });

        const res = await restoreSession();
        expect(res).toBe(true);
        expect(api.post).toHaveBeenCalledWith('/auth/refresh');
        expect(useAuth.getState().user).toEqual(refreshedUser);
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
