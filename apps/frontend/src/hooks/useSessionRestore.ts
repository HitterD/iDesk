import { useState, useEffect } from 'react';
import { useAuth } from '../stores/useAuth';
import api, { refreshSession } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { toast } from 'sonner';
import { SessionCoordinationUnavailableError } from '../lib/sessionCoordinator';

let restorePromise: Promise<boolean> | null = null;

export function restoreSession(): Promise<boolean> {
    if (restorePromise) return restorePromise;

    restorePromise = (async () => {
        const getState = (useAuth as any)?.getState;
        if (typeof getState !== 'function') {
            return false;
        }
        useAuth.setState({ restoreError: null, isRestoringSession: true });
        const state = getState();
        const isCurrent = () => getState().generation === state.generation;

        // 1. If marked as authenticated and not locally expired, verify that the active HttpOnly cookie
        // actually matches the user stored in localStorage.
        if (state.isAuthenticated && state.user && !state.isSessionExpired()) {
            if (typeof api.get === 'function') {
                try {
                    const meRes = await api.get('/users/me', { skipToast: true, skipSessionRefresh: true });
                    if (!isCurrent()) return getState().isAuthenticated;
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
                    if (!isCurrent()) return getState().isAuthenticated;
                    const status = err?.response?.status;
                    // If offline / network error, allow graceful degradation if not locally expired
                    if (!err?.response && typeof navigator !== 'undefined' && !navigator.onLine) {
                        return true;
                    }
                    if (status !== 401) {
                        useAuth.setState({ restoreError: 'Verifikasi sesi gagal sementara. Periksa koneksi dan coba lagi.' });
                        toast.error('Verifikasi sesi gagal sementara. Periksa koneksi dan coba lagi.');
                        return state.isAuthenticated;
                    }
                    // If 401, access token expired -> fall through to /auth/refresh below
                }
            } else {
                return true;
            }
        }

        // 2. Refresh flow: access token expired, session expired, or not authenticated
        try {
            const res = await refreshSession();
            if (!isCurrent()) return getState().isAuthenticated;
            const data = res.data as { user?: any; expiresAt?: string };
            if (data?.user) {
                const prevUserId = state.user?.id;
                if (prevUserId && prevUserId !== data.user.id) {
                    try {
                        queryClient.cancelQueries();
                        queryClient.clear();
                    } catch {}
                }
                if (state.isAuthenticated && prevUserId === data.user.id) {
                    state.updateUser(data.user);
                    state.setExpiresAt(data.expiresAt || null);
                } else {
                    state.login(data.user, data.expiresAt || null);
                }
                (api as any)?.resetLoginRedirectState?.();
                return true;
            }
        } catch (error: unknown) {
            if (!isCurrent()) return getState().isAuthenticated;
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status !== 401) {
                const message = error instanceof SessionCoordinationUnavailableError ? error.message : 'Pemulihan sesi gagal sementara. Periksa koneksi dan coba lagi.';
                useAuth.setState({ restoreError: message });
                toast.error(message);
                return state.isAuthenticated;
            }
            // Refresh token missing or expired: if locally authenticated or expired, clean up
            if (state.isSessionExpired() || state.isAuthenticated) {
                state.logout();
                useAuth.setState({ sessionRejected: true });
            }
        }
        return false;
    })().finally(() => {
        useAuth.setState({ isRestoringSession: false });
        restorePromise = null;
    });

    return restorePromise;
}

export function _resetRestorePromiseForTest(): void {
    restorePromise = null;
}

export function useSessionRestore(): { isRestoring: boolean } {
    const [isRestoring, setIsRestoring] = useState(true);

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
