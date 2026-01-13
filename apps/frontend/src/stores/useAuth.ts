import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { disconnectSocket } from '../lib/socket';
import { createEncryptedStorage } from '../lib/crypto';

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
    token: string | null;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    updateUser: (user: Partial<User>) => void;
}

// 4.3.2 - Zustand Persist with Encrypted Storage
export const useAuth = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            login: (token, user) => set({ token, user }),
            logout: () => {
                disconnectSocket();
                set({ token: null, user: null });
            },
            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null,
            })),
        }),
        {
            name: 'auth-storage',
            // Use encrypted storage for sensitive auth data (4.3.2)
            storage: createJSONStorage(() => createEncryptedStorage()),
        }
    )
);

