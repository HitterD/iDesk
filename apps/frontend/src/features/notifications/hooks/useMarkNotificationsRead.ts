import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import type { NotificationCategory } from '@/components/notifications/types/notification.types';

/** Server event: some of this user's notifications became read (here or in another tab/device). */
export const NOTIFICATIONS_READ_EVENT = 'notifications:read';

export type NotificationReadTarget =
    | { ticketId: string }
    | { referenceId: string }
    | { category: NotificationCategory };

const targetKey = (target: NotificationReadTarget | null): string | null =>
    target ? JSON.stringify(target) : null;

/**
 * Marks the user's notifications about the page they opened as read, so the bell clears
 * without a trip to the Notification Center. Pass null while the id is not known yet.
 */
export function useMarkNotificationsRead(target: NotificationReadTarget | null): void {
    const queryClient = useQueryClient();
    const userId = useAuth().user?.id;
    const key = targetKey(target);

    useEffect(() => {
        if (!key || !userId) return;
        api.post('/notifications/read-by-target', JSON.parse(key), { skipToast: true })
            .then((res) => {
                if (res.data?.updated > 0) {
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }
            })
            .catch(() => {
                // Best effort: the notification simply stays unread and can still be cleared by hand.
            });
    }, [key, userId, queryClient]);
}

/** Refreshes notification lists and badges whenever the server reports notifications as read. */
export function useNotificationsReadSync(): void {
    const queryClient = useQueryClient();
    const { socket } = useSocket();

    useEffect(() => {
        const handleRead = () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        };
        socket.on(NOTIFICATIONS_READ_EVENT, handleRead);
        return () => {
            socket.off(NOTIFICATIONS_READ_EVENT, handleRead);
        };
    }, [socket, queryClient]);
}
