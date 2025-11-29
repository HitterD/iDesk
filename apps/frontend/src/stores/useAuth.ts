import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectSocket } from '../lib/socket';

interface User {
    id: string;
    email: string;
    fullName: string;
    role: 'ADMIN' | 'AGENT' | 'USER';
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
}

export const useAuth = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            login: (token, user) => set({ token, user }),
            logout: () => {
                // Disconnect socket to prevent memory leaks
                disconnectSocket();
                set({ token: null, user: null });
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);
