import { useEffect, useState, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import type { Ticket, TicketMessage } from '@/lib/api/types';

// Use TicketMessage from types instead of local interface
type Message = TicketMessage;

// Ticket data type for socket events
type TicketSocketData = Partial<Ticket> & { id: string };

/** How often a ticket page refetches while the socket is down, so missed messages still show up. */
export const TICKET_OFFLINE_POLL_MS = 15000;
/** Window in which the message + notification events for one reply share a single resync. */
export const TICKET_RESYNC_DEBOUNCE_MS = 500;

/** Tickets open on screen right now: reading them (GET /tickets/:id) clears their unread chat on the server. */
const openTickets = new Set<string>();

/** Patch every cached ticket list so one ticket's "new message" badge shows read/unread without a refetch. */
const patchListUnread = (queryClient: QueryClient, ticketId: string, unread: boolean) => {
    const patch = (t: any) =>
        t.id !== ticketId
            ? t
            : unread
                ? { ...t, hasUnreadChat: true, unreadMessageCount: (t.unreadMessageCount || 0) + 1 }
                : { ...t, hasUnreadChat: false, unreadMessageCount: 0 };
    queryClient.setQueriesData({ queryKey: ['tickets'] }, (oldData: any) => {
        if (!oldData) return oldData;
        if (oldData.data && Array.isArray(oldData.data)) return { ...oldData, data: oldData.data.map(patch) };
        if (Array.isArray(oldData)) return oldData.map(patch);
        return oldData;
    });
};

interface UseTicketSocketOptions {
    ticketId: string | undefined;
    onNewMessage?: (message: Message) => void;
    onStatusChange?: (status: string) => void;
}

export const useTicketSocket = ({ ticketId, onNewMessage, onStatusChange }: UseTicketSocketOptions) => {
    const { socket, isConnected } = useSocket();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({});
    const typingTimersRef = useRef<{ [socketId: string]: ReturnType<typeof setTimeout> }>({});

    // Callbacks live in refs so a caller passing inline functions doesn't re-run the room effect.
    // Every re-run leaves and re-joins the room, and events sent in that gap were being lost.
    const onNewMessageRef = useRef(onNewMessage);
    const onStatusChangeRef = useRef(onStatusChange);
    useEffect(() => {
        onNewMessageRef.current = onNewMessage;
        onStatusChangeRef.current = onStatusChange;
    }, [onNewMessage, onStatusChange]);

    // Opening the ticket reads its chat: the list badge goes now, and the list refetches when shown again.
    useEffect(() => {
        if (!ticketId) return;
        openTickets.add(ticketId);
        patchListUnread(queryClient, ticketId, false);
        return () => {
            openTickets.delete(ticketId);
            queryClient.invalidateQueries({ queryKey: ['tickets'], refetchType: 'none' });
        };
    }, [ticketId, queryClient]);

    // Join ticket room when connected, and auto-rejoin on reconnect
    useEffect(() => {
        if (!ticketId) return;

        // Auto-rejoin ticket room on every connect and reconnect
        const joinTicketRoom = () => {
            if (socket.connected) {
                socket.emit('join:ticket', ticketId);
            }
        };

        // After a reconnect, anything sent while we were offline was missed: refetch it.
        const handleReconnect = () => {
            joinTicketRoom();
            queryClient.invalidateQueries({ queryKey: ['ticket', ticketId], refetchType: 'active' });
            queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId], refetchType: 'active' });
        };

        joinTicketRoom();
        socket.on('connect', handleReconnect);

        // One new message arrives as both `ticket:newMessage` and a `notification:*` event:
        // coalesce their background resync into a single refetch of the ticket.
        let resyncTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleTicketResync = (includeMessages: boolean) => {
            if (includeMessages) resyncMessages = true;
            if (resyncTimer) return;
            resyncTimer = setTimeout(() => {
                resyncTimer = null;
                queryClient.invalidateQueries({ queryKey: ['ticket', ticketId], refetchType: 'active' });
                if (resyncMessages) queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId], refetchType: 'active' });
                resyncMessages = false;
            }, TICKET_RESYNC_DEBOUNCE_MS);
        };
        let resyncMessages = false;

        // Listen for new messages
        const handleNewMessage = (data: { ticketId: string; message: Message }) => {
            if (data.ticketId === ticketId) {
                // Clear any typing indicator for this ticket immediately upon message arrival
                Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
                typingTimersRef.current = {};
                setTypingUsers({});

                // Optimistically update the main ticket cache
                queryClient.setQueryData(['ticket', ticketId], (oldData: Ticket | undefined) => {
                    if (!oldData) return oldData;
                    // Check if message already exists to prevent duplicates
                    if (oldData.messages?.some((m: Message) => m.id === data.message.id)) {
                        return oldData;
                    }
                    return {
                        ...oldData,
                        messages: [...(oldData.messages || []), data.message]
                    };
                });

                // Also update the dedicated messages cache (used by client detail page)
                queryClient.setQueryData(['ticket-messages', ticketId], (oldMessages: Message[] | undefined) => {
                    if (!oldMessages) return oldMessages;
                    if (oldMessages.some((m: Message) => m.id === data.message.id)) {
                        return oldMessages;
                    }
                    return [...oldMessages, data.message];
                });

                // Fail-safe: resync in background so relations/SLA/unread state catch up (debounced).
                scheduleTicketResync(false);

                // Call custom handler if provided
                onNewMessageRef.current?.(data.message);
            }
        };

        // Listen for status changes
        const handleStatusChange = (data: { ticketId: string; status: string }) => {
            if (data.ticketId === ticketId) {
                // Optimistically update status
                queryClient.setQueryData(['ticket', ticketId], (oldData: Ticket | undefined) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        status: data.status
                    };
                });

                onStatusChangeRef.current?.(data.status);
            }
        };

        // Listen for ticket updates
        const handleTicketUpdate = (data: { ticketId: string }) => {
            if (data.ticketId === ticketId) {
                // For general updates, we still invalidate to ensure full consistency
                queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            }
        };

        // Typing indicators with 3.5s auto-expire TTL to eliminate ghost typing
        const handleTypingStart = (data: { ticketId: string; user: { fullName: string }; socketId: string }) => {
            if (data.ticketId === ticketId && data.socketId) {
                setTypingUsers(prev => ({ ...prev, [data.socketId]: data.user?.fullName || 'User' }));

                // Reset auto-expire timer for this socket
                if (typingTimersRef.current[data.socketId]) {
                    clearTimeout(typingTimersRef.current[data.socketId]);
                }

                typingTimersRef.current[data.socketId] = setTimeout(() => {
                    setTypingUsers(prev => {
                        const newState = { ...prev };
                        delete newState[data.socketId];
                        return newState;
                    });
                    delete typingTimersRef.current[data.socketId];
                }, 3500);
            }
        };

        const handleTypingStop = (data?: { ticketId?: string; socketId?: string }) => {
            if (!data || !data.ticketId || data.ticketId === ticketId) {
                if (data?.socketId) {
                    if (typingTimersRef.current[data.socketId]) {
                        clearTimeout(typingTimersRef.current[data.socketId]);
                        delete typingTimersRef.current[data.socketId];
                    }
                    setTypingUsers(prev => {
                        const newState = { ...prev };
                        delete newState[data.socketId!];
                        return newState;
                    });
                } else {
                    // Global clear for this ticket
                    Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
                    typingTimersRef.current = {};
                    setTypingUsers({});
                }
            }
        };

        // Fail-safe synchronization: when in-app notification for this ticket arrives, sync query & clear typing
        const handleNotificationSync = (notifData: any) => {
            const incomingTicketId = notifData?.ticketId || notifData?.notification?.ticketId;
            if (incomingTicketId === ticketId) {
                Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
                typingTimersRef.current = {};
                setTypingUsers({});
                scheduleTicketResync(true);
            }
        };

        socket.on('ticket:newMessage', handleNewMessage);
        socket.on('ticket:statusChanged', handleStatusChange);
        socket.on('ticket:updated', handleTicketUpdate);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);

        if (user?.id) {
            socket.on(`notification:${user.id}`, handleNotificationSync);
        }
        socket.on('notification:new', handleNotificationSync);

        // Cleanup
        return () => {
            socket.off('connect', handleReconnect);
            socket.emit('leave:ticket', ticketId);
            socket.off('ticket:newMessage', handleNewMessage);
            socket.off('ticket:statusChanged', handleStatusChange);
            socket.off('ticket:updated', handleTicketUpdate);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);

            if (user?.id) {
                socket.off(`notification:${user.id}`, handleNotificationSync);
            }
            socket.off('notification:new', handleNotificationSync);
            if (resyncTimer) clearTimeout(resyncTimer);

            // Clear typing timeouts and the names they guard; a name left without its timer never expires.
            Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
            typingTimersRef.current = {};
            setTypingUsers({});
        };
    }, [ticketId, socket, queryClient, user?.id]);

    const sendTypingStart = (user: { fullName: string }) => {
        if (ticketId && isConnected) {
            socket.emit('typing:start', { ticketId, user });
        }
    };

    const sendTypingStop = () => {
        if (ticketId && isConnected) {
            socket.emit('typing:stop', { ticketId });
        }
    };

    return { isConnected, typingUsers, sendTypingStart, sendTypingStop };
};

/**
 * One ticket change fans out as several socket events (updated, statusChanged, listUpdated...).
 * Invalidations inside this window collapse into a single refetch per query key.
 */
export const LIST_INVALIDATE_DEBOUNCE_MS = 1000;
const TICKETS_KEY = 'tickets';
const DASHBOARD_STATS_KEY = 'dashboard-stats';

// Hook for ticket list real-time updates
export const useTicketListSocket = (options?: {
    onNewTicket?: (ticket: Ticket) => void;
    onTicketUpdated?: (data: any) => void;
}) => {
    const { socket, isConnected } = useSocket();
    const queryClient = useQueryClient();

    const onNewTicketRef = useRef(options?.onNewTicket);
    const onTicketUpdatedRef = useRef(options?.onTicketUpdated);

    useEffect(() => {
        onNewTicketRef.current = options?.onNewTicket;
        onTicketUpdatedRef.current = options?.onTicketUpdated;
    }, [options?.onNewTicket, options?.onTicketUpdated]);

    useEffect(() => {
        if (!isConnected) return;

        const pendingKeys = new Set<string>();
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const scheduleInvalidate = (...keys: string[]) => {
            keys.forEach((key) => pendingKeys.add(key));
            if (flushTimer) return;
            flushTimer = setTimeout(() => {
                flushTimer = null;
                const keysToFlush = Array.from(pendingKeys);
                pendingKeys.clear();
                keysToFlush.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
            }, LIST_INVALIDATE_DEBOUNCE_MS);
        };

        const handleListUpdate = () => {
            scheduleInvalidate(TICKETS_KEY, DASHBOARD_STATS_KEY);
        };

        const handleNewTicket = (ticket: Ticket) => {
            scheduleInvalidate(TICKETS_KEY, DASHBOARD_STATS_KEY);
            if (onNewTicketRef.current) {
                onNewTicketRef.current(ticket);
            }
        };

        const handleTicketUpdated = (data: any) => {
            scheduleInvalidate(TICKETS_KEY, DASHBOARD_STATS_KEY);
            if (onTicketUpdatedRef.current) {
                onTicketUpdatedRef.current(data);
            }
        };

        const handleNewMessage = (data: any) => {
            const ticketId = data.ticketId || data.message?.ticketId;
            // Unknown ticket: fall back to a refetch. Otherwise the cache patch below is enough;
            // invalidating would refetch every mounted ticket list just to show an unread dot.
            if (!ticketId) {
                scheduleInvalidate(TICKETS_KEY);
                return;
            }
            // A ticket open on screen is being read as the message lands: no badge for it.
            if (!openTickets.has(ticketId)) patchListUnread(queryClient, ticketId, true);
        };

        socket.on('tickets:listUpdated', handleListUpdate);
        socket.on('tickets:statusChanged', handleListUpdate);
        socket.on('ticket:assigned', handleListUpdate);
        socket.on('ticket:priority_changed', handleListUpdate);
        socket.on('ticket:created', handleNewTicket);
        socket.on('ticket:updated', handleTicketUpdated);
        socket.on('ticket:newMessage', handleNewMessage);
        socket.on('NEW_MESSAGE', handleNewMessage);
        const handleStatsUpdate = () => scheduleInvalidate(DASHBOARD_STATS_KEY);
        socket.on('dashboard:stats:update', handleStatsUpdate);

        return () => {
            if (flushTimer) clearTimeout(flushTimer);
            socket.off('tickets:listUpdated', handleListUpdate);
            socket.off('tickets:statusChanged', handleListUpdate);
            socket.off('ticket:assigned', handleListUpdate);
            socket.off('ticket:priority_changed', handleListUpdate);
            socket.off('ticket:created', handleNewTicket);
            socket.off('ticket:updated', handleTicketUpdated);
            socket.off('ticket:newMessage', handleNewMessage);
            socket.off('NEW_MESSAGE', handleNewMessage);
            socket.off('dashboard:stats:update', handleStatsUpdate);
        };
    }, [isConnected, socket, queryClient]);

    return { isConnected };
};
