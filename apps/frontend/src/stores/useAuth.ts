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
}

interface AuthState {
    // Token is now in HttpOnly cookie - only store user info
    user: User | null;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
}

export const useAuth = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            login: (user) => set({ user, isAuthenticated: true }),
            logout: () => {
                disconnectSocket();
                set({ user: null, isAuthenticated: false });
            },
            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
            })),
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
