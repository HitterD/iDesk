import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface NotificationItem {
    id: string
    title: string
    message: string
    type: 'RENEWAL' | 'HARDWARE' | 'TICKET' | 'OTHER'
    timestamp: number
    link?: string
    priority: 'HIGH' | 'NORMAL'
    isRead: boolean
    ticketId?: string
}

interface NotificationState {
    notifications: NotificationItem[]
    unreadCount: number

    addNotification: (item: Omit<NotificationItem, 'timestamp' | 'isRead'>) => void
    markAsRead: (id: string) => void
    clearAll: () => void
    remove: (id: string) => void
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set, get) => ({
            notifications: [],
            unreadCount: 0,

            addNotification: (item) => {
                const newItem: NotificationItem = {
                    ...item,
                    timestamp: Date.now(),
                    isRead: false
                }

                set((state) => ({
                    notifications: [newItem, ...state.notifications],
                    unreadCount: state.unreadCount + 1
                }))
            },

            markAsRead: (id) => {
                const { notifications } = get()
                const target = notifications.find(n => n.id === id)
                if (!target || target.isRead) return

                set((state) => ({
                    notifications: state.notifications.map(n =>
                        n.id === id ? { ...n, isRead: true } : n
                    ),
                    unreadCount: Math.max(0, state.unreadCount - 1)
                }))
            },

            clearAll: () => set({ notifications: [], unreadCount: 0 }),

            remove: (id) => set((state) => ({
                notifications: state.notifications.filter(n => n.id !== id),
                unreadCount: state.notifications.find(n => n.id === id)?.isRead
                    ? state.unreadCount
                    : Math.max(0, state.unreadCount - 1)
            }))
        }),
        {
            name: 'idesk-notifications',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
