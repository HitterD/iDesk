/**
 * Auth Store - Zustand state management for authentication
 * 
 * Handles:
 * - User login/logout with iDesk backend
 * - RBAC enforcement (only AGENT and ADMIN roles allowed)
 * - Session persistence
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authService, type User } from '@/services/auth.service'

interface AuthState {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    error: string | null
    login: (email: string, pass: string) => Promise<void>
    logout: () => Promise<void>
    checkAuth: () => Promise<void>
}

// Helper: Check if preload APIs are available
const hasIpcRenderer = () => {
    return typeof window !== 'undefined' && window.ipcRenderer !== undefined
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            error: null,

            checkAuth: async () => {
                // If preload failed, ipcRenderer won't exist
                if (!hasIpcRenderer()) {
                    console.error('[AUTH] ipcRenderer not available - preload script may have failed')
                    set({ user: null, isAuthenticated: false, isLoading: false, error: 'Desktop integration unavailable' })
                    return
                }

                try {
                    const token = await window.ipcRenderer.getCookie('access_token')
                    if (!token) {
                        // Token expired or missing
                        set({ user: null, isAuthenticated: false, isLoading: false })
                        return
                    }
                    // Token exists, trust persisted state
                    set({ isLoading: false })
                } catch (e) {
                    console.error('[AUTH] checkAuth failed:', e)
                    set({ user: null, isAuthenticated: false, isLoading: false })
                }
            },

            login: async (email, password) => {
                set({ error: null })

                try {
                    const user = await authService.login(email, password)

                    // Strict RBAC: Only AGENT and ADMIN allowed
                    if (user.role !== 'AGENT' && user.role !== 'ADMIN') {
                        await authService.logout()
                        throw new Error('Access Denied: Only Agents and Admins may use this application.')
                    }

                    set({ user, isAuthenticated: true, error: null })
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Authentication failed'
                    set({ error: message })
                    throw err
                }
            },

            logout: async () => {
                try {
                    await authService.logout()
                    if (hasIpcRenderer()) {
                        await window.ipcRenderer.clearJwt()
                    }
                } catch (e) {
                    console.error('[AUTH] Logout error:', e)
                }
                set({ user: null, isAuthenticated: false, error: null })
            }
        }),
        {
            name: 'idesk-auth-storage',
            storage: createJSONStorage(() => localStorage), // Use localStorage for persistence
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
)
