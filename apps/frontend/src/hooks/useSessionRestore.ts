import { useState, useEffect } from 'react';
import { useAuth } from '../stores/useAuth';
import api from '../lib/api';
import { queryClient } from '../lib/queryClient';

let restorePromise: Promise<boolean> | null = null;

export function restoreSession(): Promise<boolean> {
    if (restorePromise) return restorePromise;

    restorePromise = (async () => {
        const getState = (useAuth as any)?.getState;
        if (typeof getState !== 'function') {
            return false;
        }
        const state = getState();

        // 1. If marked as authenticated and not locally expired, verify that the active HttpOnly cookie
        // actually matches the user stored in localStorage.
        if (state.isAuthenticated && state.user && !state.isSessionExpired()) {
            if (typeof api.get === 'function') {
                try {
                    const meRes = await api.get('/users/me', { skipToast: true });
                    const backendUser = meRes.data;
                    if (backendUser && backendUser.id) {
                        if (backendUser.id !== state.user.id) {
                            // Cookie belongs to a different user (e.g. multi-tab switch or SSO login)
                            state.login(backendUser, state.expiresAt);
                            try {
                                queryClient.cancelQueries();
                                queryClient.clear();
                            } catch {}
                        } else {
                            state.updateUser(backendUser);
                        }
                        return true;
                    }
                } catch (err: any) {
                    const status = err?.response?.status;
                    // If offline / network error, allow graceful degradation if not locally expired
                    if (!err?.response && typeof navigator !== 'undefined' && !navigator.onLine) {
                        return true;
                    }
                    if (status !== 401) {
                        // Forbidden, account deactivated, or severe auth error
                        state.logout();
                        return false;
                    }
                    // If 401, access token expired -> fall through to /auth/refresh below
                }
            } else {
                return true;
            }
        }

        // 2. Refresh flow: access token expired, session expired, or not authenticated
        try {
            const res = await api.post('/auth/refresh');
            const data = res.data as { user?: any; expiresAt?: string };
            if (data?.user) {
                const prevUserId = state.user?.id;
                if (prevUserId && prevUserId !== data.user.id) {
                    try {
                        queryClient.cancelQueries();
                        queryClient.clear();
                    } catch {}
                }
                state.login(data.user, data.expiresAt || null);
                (api as any)?.resetLoginRedirectState?.();
                return true;
            }
        } catch {
            // Refresh token missing or expired: if locally authenticated or expired, clean up
            if (state.isSessionExpired() || state.isAuthenticated) {
                state.logout();
            }
        }
        return false;
    })().finally(() => {
        restorePromise = null;
    });

    return restorePromise;
}

export function _resetRestorePromiseForTest(): void {
    restorePromise = null;
}

export function useSessionRestore(): { isRestoring: boolean } {
    const isAuthenticated = useAuth((s) => s.isAuthenticated);
    const isExpired = useAuth((s) => s.isSessionExpired());
    const [isRestoring, setIsRestoring] = useState(() => {
        return !isAuthenticated || isExpired;
    });

    useEffect(() => {
        let mounted = true;
        // Verify session / cookie validity on mount
        restoreSession().finally(() => {
            if (mounted) {
                setIsRestoring(false);
            }
        });

        return () => {
            mounted = false;
        };
    }, []);

    return { isRestoring };
}
