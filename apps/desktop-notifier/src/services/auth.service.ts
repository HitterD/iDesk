import { api } from '@/libs/axios'

export interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    role: 'ADMIN' | 'AGENT' | 'USER' | 'MANAGER'
}

export interface LoginResponse {
    user: User
    expiresIn: string
    expiresAt: string
}

export const authService = {
    async login(email: string, password: string): Promise<User> {
        const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
        return data.user
    },

    async logout(): Promise<void> {
        await api.post('/auth/logout')
    },

    async me(): Promise<User> {
        // Backend doesn't have a standard /auth/me in the controller I saw?
        // Usually it's GET /users/me or check session?
        // We can use the user object returned from login for now.
        // If we need to re-fetch on reload, we might need an endpoint.
        // Assuming /users/profile exists (Standard in many nests)
        // Or we rely on persisted storage.
        // Let's assume we need to persist user in local storage or zustand persist.
        // But to be safe, let's try GET /auth/profile if it existed, but it didn't in controller.
        // We'll rely on the Login Response initial load. 
        // If app restarts, we might lack a way to get user details solely from cookie without an endpoint.
        // I should check UsersController.
        throw new Error('Not implemented')
    }
}
