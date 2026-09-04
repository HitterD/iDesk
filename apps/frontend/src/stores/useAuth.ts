import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { disconnectSocket } from '../lib/socket';
import api from '../lib/api';
import { queryClient } from '../lib/queryClient';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'AGENT_OPERATIONAL_SUPPORT' | 'AGENT_ORACLE' | 'AGENT_WEB_DEV' | 'AGENT_MOBILE_DEV' | 'AGENT_ADMIN' | 'USER';
    avatarUrl?: string;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
    departmentId?: string;
    siteId?: string;
    mustChangePassword?: boolean;
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
            login: (user, expiresAt) => {
                const nextExpiresAt = typeof expiresAt === 'string' && expiresAt ? expiresAt : null;
                set({ user, isAuthenticated: true, expiresAt: nextExpiresAt, justLoggedIn: true });
            },
            logout: () => {
                set({ user: null, isAuthenticated: false, expiresAt: null, justLoggedIn: false });
                disconnectSocket();
                try { localStorage.removeItem('auth-storage'); } catch {}
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
            }),
            storage: createJSONStorage(() => localStorage),
        }
    )
);

// Register store handlers to api interceptor to safely avoid circular require()
try {
    (api as any)?.registerAuthHandlers?.({
        logout: () => useAuth.getState().logout(),
        setExpiresAt: (expiresAt: string | null) => useAuth.getState().setExpiresAt(expiresAt),
        isAuthenticated: () => useAuth.getState().isAuthenticated,
    });
} catch {}

/**
 * Async logout function that clears the HttpOnly cookie via backend
 * Call this instead of useAuth.logout() for full logout flow
 */
export async function performLogout(): Promise<void> {
    const { logout } = useAuth.getState();

    // Cancel in-flight background queries before cookie removal
    try {
        queryClient.cancelQueries();
    } catch {}

    try {
        // Call backend to clear HttpOnly cookie
        await api.post('/auth/logout');
    } catch (error) {
        // Even if API fails, still clear local state
        console.error('Logout API error:', error);
    }

    // Clear local state and query cache
    logout();
}

