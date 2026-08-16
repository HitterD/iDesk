import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { disconnectSocket } from '../lib/socket';
import api from '../lib/api';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER';
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
    login: (user: User, expiresAt?: string | null) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
    setExpiresAt: (expiresAt: string | null) => void;
    /** True when we have a future expiry; false otherwise. */
    isSessionExpired: () => boolean;
}

export const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            expiresAt: null,
            login: (user, expiresAt) => {
                const nextExpiresAt = typeof expiresAt === 'string' && expiresAt ? expiresAt : get().expiresAt;
                set({ user, isAuthenticated: true, expiresAt: nextExpiresAt ?? null });
            },
            logout: () => {
                set({ user: null, isAuthenticated: false, expiresAt: null });
                disconnectSocket();
            },
            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
            })),
            setExpiresAt: (expiresAt) => set({ expiresAt: expiresAt ?? null }),
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
            // No encryption needed - no sensitive data stored
            // Token is in HttpOnly cookie, not accessible to JavaScript
            storage: createJSONStorage(() => localStorage),
        }
    )
);

/**
 * Async logout function that clears the HttpOnly cookie via backend
 * Call this instead of useAuth.logout() for full logout flow
 */
export async function performLogout(): Promise<void> {
    const { logout } = useAuth.getState();

    try {
        // Call backend to clear HttpOnly cookie
        await api.post('/auth/logout');
    } catch (error) {
        // Even if API fails, still clear local state
        console.error('Logout API error:', error);
    }

    // Clear local state
    logout();
}
