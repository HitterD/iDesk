import { useState, useEffect } from 'react';
import { useAuth } from '../stores/useAuth';
import api from '../lib/api';

let restorePromise: Promise<boolean> | null = null;

export function restoreSession(): Promise<boolean> {
    if (restorePromise) return restorePromise;

    restorePromise = (async () => {
        const state = useAuth.getState();
        // If already authenticated and session is not locally expired, no need to refresh immediately
        if (state.isAuthenticated && state.user && !state.isSessionExpired()) {
            return true;
        }

        try {
            const res = await api.post('/auth/refresh');
            const data = res.data as { user?: any; expiresAt?: string };
            if (data?.user) {
                state.login(data.user, data.expiresAt || null);
                (api as any)?.resetLoginRedirectState?.();
                return true;
            }
        } catch {
            // Refresh token missing or expired: if locally stale, clean up
            if (state.isSessionExpired()) {
                state.logout();
            }
        }
        return false;
    })().finally(() => {
        // Clear cached promise after short delay
        setTimeout(() => {
            restorePromise = null;
        }, 1000);
    });

    return restorePromise;
}

export function useSessionRestore(): { isRestoring: boolean } {
    const isAuthenticated = useAuth((s) => s.isAuthenticated);
    const isExpired = useAuth((s) => s.isSessionExpired());
    const [isRestoring, setIsRestoring] = useState(() => {
        return !isAuthenticated || isExpired;
    });

    useEffect(() => {
        let mounted = true;
        if (!isAuthenticated || isExpired) {
            restoreSession().finally(() => {
                if (mounted) {
                    setIsRestoring(false);
                }
            });
        } else {
            setIsRestoring(false);
        }

        return () => {
            mounted = false;
        };
    }, [isAuthenticated, isExpired]);

    return { isRestoring };
}
