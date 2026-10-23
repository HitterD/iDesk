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

interface IncomingNotification { id?: string; isRead?: boolean; ticketId?: string | null; referenceId?: string | null; category?: string | null }

/** Same matching as the backend's read-by-target (hardware references carry a "_<step>" suffix). */
function isAbout(target: NotificationReadTarget, n: IncomingNotification): boolean {
    if ('ticketId' in target) return n.ticketId === target.ticketId;
    if ('referenceId' in target) return n.referenceId === target.referenceId || Boolean(n.referenceId?.startsWith(`${target.referenceId}_`));
    return n.category === target.category;
}

/**
 * Marks the user's notifications about the page they opened as read, so the bell clears
 * without a trip to the Notification Center: once on arrival, and again for every new
 * notification about this page that arrives while it stays open (e.g. a reply in the open chat).
 * Pass null while the id is not known yet.
 */
export function useMarkNotificationsRead(target: NotificationReadTarget | null): void {
    const queryClient = useQueryClient();
    const { socket } = useSocket();
    const userId = useAuth().user?.id;
    const key = targetKey(target);

    useEffect(() => {
        if (!key || !userId) return;
        const parsed = JSON.parse(key) as NotificationReadTarget;
        const markRead = () => {
            api.post('/notifications/read-by-target', parsed, { skipToast: true })
                .then((res) => {
                    if (res.data?.updated > 0) {
                        queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    }
                })
                .catch(() => {
                    // Best effort: the notification simply stays unread and can still be cleared by hand.
                });
        };
        markRead();

        // One notification arrives on two events; act once per id.
        const handled = new Set<string>();
        const onNotification = (payload: IncomingNotification & { notification?: IncomingNotification }) => {
            const n = payload?.notification ?? payload;
            if (!n?.id || n.isRead || handled.has(n.id) || !isAbout(parsed, n)) return;
            handled.add(n.id);
            markRead();
        };
        const personalEvent = `notification:${userId}`;
        socket.on(personalEvent, onNotification);
        socket.on('notification:new', onNotification);
        return () => {
            socket.off(personalEvent, onNotification);
            socket.off('notification:new', onNotification);
        };
    }, [key, userId, queryClient, socket]);
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
