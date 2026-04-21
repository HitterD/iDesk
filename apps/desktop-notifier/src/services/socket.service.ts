import { io, Socket } from 'socket.io-client'
import { type User } from './auth.service'
import { sendNativeNotification } from '@/utils/native-notification'
import { generateId } from '@/utils/id'

class SocketService {
    private socket: Socket | null = null

    connect(user: User, token: string) {
        if (this.socket?.connected) return

        // TODO: Env var
        const URL = 'http://localhost:3000'

        this.socket = io(URL, {
            path: '/socket.io', // Standard NestJS path
            withCredentials: true,
            extraHeaders: {
                // Send cookie manually since we are in Electron Node environment (sometimes) 
                // or just to be safe if standard browser cookie isn't picked up by non-browser transport
                Cookie: `access_token=${token}`,
                Authorization: `Bearer ${token}`
            },
            transports: ['websocket', 'polling'], // Try websocket first
        })

        this.socket.on('connect', () => {
            console.log('Socket Connected:', this.socket?.id)
        })

        this.socket.on('connect_error', (err) => {
            console.error('Socket Connection Error:', err)
        })

        // Listen for personal notifications
        this.socket.on(`notification:${user.id}`, (data: any) => {
            console.log('Received Notification:', data)
            // Dispatch native notification
            this.handleNotification(data)
        })

        // Critical notifications
        this.socket.on('critical_notification', (data: any) => {
            this.handleNotification(data, true)
        })
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }
    }

    private handleNotification(data: any, isCritical = false) {
        // Determine type based on category or type string from backend
        // Backend types: TICKET_CREATED, TICKET_ASSIGNED, etc.
        // We map them to our UI types: RENEWAL, HARDWARE, TICKET, OTHER

        let type: 'RENEWAL' | 'HARDWARE' | 'TICKET' | 'OTHER' = 'OTHER'
        if (data.category === 'renewal' || data.type?.includes('renewal')) type = 'RENEWAL'
        else if (data.category === 'hardware' || data.type?.includes('hardware')) type = 'HARDWARE'
        else if (data.ticketId) type = 'TICKET'

        // Add to store
        // Dynamic import to avoid circular dependency if store imports service
        import('@/store/notification.store').then(({ useNotificationStore }) => {
            useNotificationStore.getState().addNotification({
                id: data.id || generateId(),
                title: data.title,
                message: data.message,
                type,
                priority: isCritical ? 'HIGH' : 'NORMAL',
                link: data.link,
                ticketId: data.ticketId
            })
        })

        // Check Quiet Mode
        // Dynamic import to avoid circular dependency
        import('@/store/settings.store').then(({ useSettingsStore }) => {
            const isQuiet = useSettingsStore.getState().isQuietModeActive()

            // If critical, bypass quiet mode? Maybe not.
            // Let's say Critical always bypasses unless specified?
            // For now, if generic quiet mode is on, we suppress native toasts.

            if (!isQuiet || isCritical) {
                sendNativeNotification(data.title, data.message, () => {
                    // Handle click
                    if (data.link) {
                        // Optional: IPC call to focus or open link directly
                    }
                })
            }
        })

        // Dispatch event (still useful for listing in UI even if silent)
        window.dispatchEvent(new CustomEvent('idesk:notification', { detail: { ...data, isCritical } }))
    }
}

export const socketService = new SocketService()
