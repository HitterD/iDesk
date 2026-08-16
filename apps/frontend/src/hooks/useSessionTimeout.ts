import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../stores/useAuth';
import api from '../lib/api';
import { getErrorMessage } from '../lib/errorMessages';

const WARNING_LEAD_MS = 5 * 60 * 1000;
const POLL_MS = 5 * 60 * 1000;

let hasFiredExpiryRedirect = false;

function parseExpiresAtMs(value: unknown): number | null {
    if (typeof value !== 'string' || !value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

function forceExpiredRedirect(): void {
    if (hasFiredExpiryRedirect) return;
    hasFiredExpiryRedirect = true;
    try {
        useAuth.getState().logout();
    } catch {
        try { localStorage.removeItem('auth-storage'); } catch {}
    }
    // Don't loop if already on /login — just add reason.
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next.startsWith('/login')) {
        // Preserve next if present, ensure reason=expired.
        const url = new URL(window.location.href);
        url.searchParams.set('reason', 'expired');
        window.location.replace(`${url.pathname}${url.search}${url.hash}`);
        return;
    }
    const target = `/login?next=${encodeURIComponent(next)}&reason=expired`;
    toast.error(getErrorMessage('SESSION_EXPIRED'));
    window.location.replace(target);
}

/**
 * Proactive session timeout.
 * - Schedules a hard redirect at `expiresAt` so idle tabs still fall back to /login without needing a 401 trigger.
 * - Fires a warning at T-5m and attempts a silent `POST /auth/refresh`; api interceptor syncs the new expiresAt on success.
 * - Re-arms whenever `expiresAt` changes (login/refresh) and on visibility/interval polls.
 */
export function useSessionTimeout(): void {
    const expiresAt = useAuth((s) => s.expiresAt);
    const isAuthenticated = useAuth((s) => s.isAuthenticated);

    const expiryTimeoutRef = useRef<number | null>(null);
    const warningTimeoutRef = useRef<number | null>(null);
    const pollIntervalRef = useRef<number | null>(null);

    const clearTimers = useCallback(() => {
        if (expiryTimeoutRef.current !== null) {
            window.clearTimeout(expiryTimeoutRef.current);
            expiryTimeoutRef.current = null;
        }
        if (warningTimeoutRef.current !== null) {
            window.clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = null;
        }
    }, []);

    const trySilentRefresh = useCallback(async () => {
        // Only attempt if still authenticated and not already expired.
        const state = useAuth.getState();
        if (!state.isAuthenticated) return;
        if (state.isSessionExpired()) {
            forceExpiredRedirect();
            return;
        }
        try {
            const res = await api.post('/auth/refresh');
            const nextExpiresAt: unknown = (res.data as Record<string, unknown> | undefined)?.expiresAt;
            if (typeof nextExpiresAt === 'string' && Date.parse(nextExpiresAt)) {
                // api interceptor also syncs this, but set explicitly for resilience.
                state.setExpiresAt(nextExpiresAt);
                toast.success('Session extended.');
            }
        } catch {
            // Refresh failure is handled centrally by api interceptor (forceLogout).
            // No extra action needed here; the next expiry timer will still fire.
        }
    }, []);

    const scheduleWarning = useCallback((remainingMs: number) => {
        if (remainingMs <= WARNING_LEAD_MS) return;
        warningTimeoutRef.current = window.setTimeout(async () => {
            const state = useAuth.getState();
            if (!state.isAuthenticated) return;
            const ms = parseExpiresAtMs(state.expiresAt);
            if (ms === null) return;
            if (Date.now() >= ms) {
                forceExpiredRedirect();
                return;
            }
            toast.message('Your session will expire in 5 minutes.', {
                description: 'Trying to keep you signed in…',
            });
            await trySilentRefresh();
        }, remainingMs - WARNING_LEAD_MS);
    }, [trySilentRefresh]);

    useEffect(() => {
        // Reset global guard when user logs out/in so a later session can redirect again.
        if (!isAuthenticated) {
            hasFiredExpiryRedirect = false;
            clearTimers();
            if (pollIntervalRef.current !== null) {
                window.clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        const ms = parseExpiresAtMs(expiresAt);
        if (ms === null) {
            // No expiry known — rely on reactive 401 fallback.
            clearTimers();
            return;
        }

        const remaining = ms - Date.now();
        if (remaining <= 0) {
            forceExpiredRedirect();
            return;
        }

        clearTimers();
        expiryTimeoutRef.current = window.setTimeout(() => {
            forceExpiredRedirect();
        }, remaining);

        scheduleWarning(remaining);

        return () => {
            clearTimers();
        };
        // Re-arm on every expiresAt change.
    }, [expiresAt, isAuthenticated, clearTimers, scheduleWarning]);

    // Visibility + interval polling: catches clock drift, suspended tabs, and cross-tab expiry.
    useEffect(() => {
        if (!isAuthenticated) return;

        const onVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            const state = useAuth.getState();
            if (!state.isAuthenticated) return;
            if (state.isSessionExpired()) {
                forceExpiredRedirect();
                return;
            }
            const ms = parseExpiresAtMs(state.expiresAt);
            if (ms === null) return;
            const remaining = ms - Date.now();
            // If we're inside the warning window and no warning timer is pending, nudge a refresh.
            if (remaining > 0 && remaining <= WARNING_LEAD_MS && warningTimeoutRef.current === null) {
                // Fire-and-forget
                void trySilentRefresh();
            }
        };

        const onPoll = () => {
            const state = useAuth.getState();
            if (!state.isAuthenticated) return;
            if (state.isSessionExpired()) {
                forceExpiredRedirect();
            }
        };

        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onVisibility);
        pollIntervalRef.current = window.setInterval(onPoll, POLL_MS);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', onVisibility);
            if (pollIntervalRef.current !== null) {
                window.clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [isAuthenticated, trySilentRefresh]);
}
