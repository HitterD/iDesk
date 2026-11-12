import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { disconnectSocket } from '../lib/socket';
import api from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { coordinateSession, SessionCoordinationUnavailableError } from '../lib/sessionCoordinator';
import { toast } from 'sonner';
import { dropLocalPushSubscription, releasePushSubscription } from '../lib/webPush';

let receivingStorage = false;
const clearSessionResources = () => {
    disconnectSocket();
    void queryClient.cancelQueries();
    queryClient.clear();
};

interface User {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'AGENT_OPERATIONAL_SUPPORT' | 'AGENT_ORACLE' | 'AGENT_WEB_DEV' | 'AGENT_MOBILE_DEV' | 'AGENT_ADMIN' | 'HC_ADMIN' | 'USER';
    avatarUrl?: string;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
    departmentId?: string;
    siteId?: string;
    mustChangePassword?: boolean;
    guidebookAcknowledgedAt?: string | null;
}

const parseExpiresAtMs = (value: unknown): number | null => {
    if (typeof value !== 'string' || !value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
};

interface AuthState {
    // Token is now in HttpOnly cookie - only store user info + non-sensitive expiry
    user: User | null;
    isAuthenticated: boolean;
    /** ISO string from backend `expiresAt` (non-sensitive, used for proactive timeout). */
    expiresAt: string | null;
    justLoggedIn: boolean;
    generation: number;
    sessionId: string | null;
    refreshRevision: number;
    restoreError: string | null;
    isRestoringSession: boolean;
    sessionRejected: boolean;
    login: (user: User, expiresAt?: string | null) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
    setExpiresAt: (expiresAt: string | null) => void;
    setJustLoggedIn: (val: boolean) => void;
    /** True when we have a future expiry; false otherwise. */
    isSessionExpired: () => boolean;
}

export const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            expiresAt: null,
            justLoggedIn: false,
            generation: 0,
            sessionId: null,
            refreshRevision: 0,
            restoreError: null,
            isRestoringSession: false,
            sessionRejected: false,
            login: (user, expiresAt) => {
                if (get().user?.id && get().user?.id !== user.id) clearSessionResources();
                const nextExpiresAt = typeof expiresAt === 'string' && expiresAt ? expiresAt : null;
                set({ user, isAuthenticated: true, expiresAt: nextExpiresAt, justLoggedIn: true, generation: get().generation + 1, sessionId: crypto.randomUUID(), restoreError: null, sessionRejected: false });
            },
            logout: () => {
                set({ user: null, isAuthenticated: false, expiresAt: null, justLoggedIn: false, generation: get().generation + 1, sessionId: null, restoreError: null });
                disconnectSocket();
                // Every sign-out path (expiry included), so the next person on this PC gets no toasts of this account.
                void dropLocalPushSubscription();
                try {
                    queryClient.cancelQueries();
                    queryClient.clear();
                } catch {}
            },
            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
            })),
            setExpiresAt: (expiresAt) => set({ expiresAt: expiresAt ?? null }),
            setJustLoggedIn: (val) => set({ justLoggedIn: val }),
            isSessionExpired: () => {
                const { expiresAt, isAuthenticated } = get();
                if (!isAuthenticated) return false;
                const ms = parseExpiresAtMs(expiresAt);
                if (ms === null) return false;
                return Date.now() >= ms;
            },
        }),
        {
            name: 'auth-storage',
            // Do not persist ephemeral justLoggedIn flag
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                expiresAt: state.expiresAt,
                sessionId: state.sessionId,
                refreshRevision: state.refreshRevision,
            }),
            storage: createJSONStorage(() => ({
                getItem: (key) => {
                    const raw = localStorage.getItem(key);
                    if (!raw) return null;
                    try {
                        const state = JSON.parse(raw)?.state;
                        if (!state || typeof state.isAuthenticated !== 'boolean') return null;
                        if (state.isAuthenticated && (!state.user || typeof state.user.id !== 'string' ||
                            typeof state.user.email !== 'string' || typeof state.user.fullName !== 'string' ||
                            !['ADMIN', 'MANAGER', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV', 'AGENT_ADMIN', 'USER'].includes(state.user.role))) return null;
                        if (state.expiresAt != null && (typeof state.expiresAt !== 'string' || !Number.isFinite(Date.parse(state.expiresAt)))) return null;
                        if (state.sessionId != null && typeof state.sessionId !== 'string') return null;
                        if (state.refreshRevision !== undefined && (!Number.isSafeInteger(state.refreshRevision) || state.refreshRevision < 0)) return null;
                        return raw;
                    } catch { return null; }
                },
                setItem: (key, value) => { if (!receivingStorage) localStorage.setItem(key, value); },
                removeItem: (key) => { if (!receivingStorage) localStorage.removeItem(key); },
            })),
        }
    )
);

// Register store handlers to api interceptor to safely avoid circular require()
try {
    (api as any)?.registerAuthHandlers?.({
        logout: () => useAuth.getState().logout(),
        setExpiresAt: (expiresAt: string | null) => useAuth.getState().setExpiresAt(expiresAt),
        isAuthenticated: () => useAuth.getState().isAuthenticated,
        generation: () => useAuth.getState().generation,
        session: () => useAuth.getState(),
        syncStorage: () => {
            const stored = localStorage.getItem('auth-storage');
            if (!stored && !useAuth.getState().isAuthenticated) return;
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'auth-storage', newValue: stored,
            }));
        },
        applyRefresh: (data: { user?: User; expiresAt?: string }) => {
            if (!data.user) return;
            const state = useAuth.getState();
            useAuth.setState({ refreshRevision: state.refreshRevision + 1 });
            if (state.isAuthenticated && state.user?.id === data.user.id) {
                state.updateUser(data.user);
                state.setExpiresAt(data.expiresAt ?? null);
            } else state.login(data.user, data.expiresAt ?? null);
        },
    });
} catch {}

/**
 * Async logout function that clears the HttpOnly cookie via backend
 * Call this instead of useAuth.logout() for full logout flow
 */
export async function performLogout(): Promise<void> {
    const { user, logout, generation, sessionId } = useAuth.getState();
    let didLogout = false;
    const logoutPayload = {
        identifier: user?.email || '',
        employeeId: user?.employeeId || '',
    };

    // Cancel in-flight background queries before cookie removal
    try {
        queryClient.cancelQueries();
    } catch {}

    try {
        // Call backend to clear HttpOnly cookie
        await coordinateSession(async () => {
            const stored = localStorage.getItem('auth-storage');
            window.dispatchEvent(new StorageEvent('storage', { key: 'auth-storage', newValue: stored }));
            const current = useAuth.getState();
            if (current.generation !== generation || current.sessionId !== sessionId) return;
            try {
                // Before the cookie is cleared: the unsubscribe call needs the session.
                await releasePushSubscription();
                await api.post('/auth/logout');
            } catch {
                console.error('Logout API failed');
            } finally {
                if (useAuth.getState().generation === generation) {
                    logout();
                    didLogout = true;
                }
            }
        });
    } catch (error) {
        toast.error(error instanceof SessionCoordinationUnavailableError ? error.message : 'Logout gagal. Coba lagi.');
        return;
    }

    if (!didLogout) return;

    // Auto-logout SJA Desktop Notifier on local machine if active (port 18399)
    // Kirim identitas akun yang sedang logout agar SJA Desktop Notifier tidak salah log out akun orang lain
    try {
        fetch('http://127.0.0.1:18399/session/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logoutPayload),
        }).catch(() => {});
    } catch {}
}

// Cross-tab synchronization: keep all tabs in sync when user logs in/out in another tab
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === 'auth-storage') {
            receivingStorage = true;
            try {
                if (!event.newValue) {
                    useAuth.getState().logout();
                    return;
                }
                const parsed = JSON.parse(event.newValue);
                const storedState = parsed?.state;
                if (!storedState || typeof storedState.isAuthenticated !== 'boolean') return;
                if (storedState.expiresAt !== null && storedState.expiresAt !== undefined &&
                    (typeof storedState.expiresAt !== 'string' || !Number.isFinite(Date.parse(storedState.expiresAt)))) return;
                if (storedState.refreshRevision !== undefined && (!Number.isSafeInteger(storedState.refreshRevision) || storedState.refreshRevision < 0)) return;
                if (storedState.sessionId !== null && storedState.sessionId !== undefined && typeof storedState.sessionId !== 'string') return;
                if (storedState.isAuthenticated && (!storedState.user ||
                    typeof storedState.user.id !== 'string' || !storedState.user.id ||
                    typeof storedState.user.email !== 'string' || typeof storedState.user.fullName !== 'string' ||
                    !['ADMIN', 'MANAGER', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV', 'AGENT_ADMIN', 'USER'].includes(storedState.user.role))) return;
                if (!storedState.isAuthenticated) {
                    if (useAuth.getState().isAuthenticated) useAuth.getState().logout();
                } else {
                    const currentUserId = useAuth.getState().user?.id;
                    if (storedState.sessionId === useAuth.getState().sessionId &&
                        storedState.refreshRevision !== undefined && storedState.refreshRevision < useAuth.getState().refreshRevision) return;
                    if (currentUserId !== storedState.user.id) clearSessionResources();
                    useAuth.setState({
                            user: storedState.user,
                            isAuthenticated: true,
                            expiresAt: storedState.expiresAt ?? null,
                            justLoggedIn: false,
                            generation: useAuth.getState().generation + (currentUserId !== storedState.user.id || (storedState.sessionId && storedState.sessionId !== useAuth.getState().sessionId) ? 1 : 0),
                            sessionId: storedState.sessionId ?? useAuth.getState().sessionId,
                            refreshRevision: storedState.refreshRevision ?? useAuth.getState().refreshRevision,
                    });
                }
            } catch {
                // Ignore malformed storage events without publishing another event.
            } finally {
                receivingStorage = false;
            }
        }
    });
}


