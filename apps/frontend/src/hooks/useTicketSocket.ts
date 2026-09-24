import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import type { Ticket, TicketMessage } from '@/lib/api/types';

// Use TicketMessage from types instead of local interface
type Message = TicketMessage;

// Ticket data type for socket events
type TicketSocketData = Partial<Ticket> & { id: string };

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

    // Join ticket room when connected, and auto-rejoin on reconnect
    useEffect(() => {
        if (!ticketId) return;

        // Auto-rejoin ticket room on every connect and reconnect
        const joinTicketRoom = () => {
            if (socket.connected) {
                socket.emit('join:ticket', ticketId);
            }
        };

        joinTicketRoom();
        socket.on('connect', joinTicketRoom);

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

                // Fail-safe: invalidate query in background to ensure all relations/SLA/unread state are synced
                queryClient.invalidateQueries({ queryKey: ['ticket', ticketId], refetchType: 'active' });

                // Call custom handler if provided
                if (onNewMessage) {
                    onNewMessage(data.message);
                }
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

                if (onStatusChange) {
                    onStatusChange(data.status);
                }
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
                queryClient.invalidateQueries({ queryKey: ['ticket', ticketId], refetchType: 'active' });
                queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId], refetchType: 'active' });
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
            socket.off('connect', joinTicketRoom);
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

            // Clear all active typing timeouts
            Object.values(typingTimersRef.current).forEach(t => clearTimeout(t));
            typingTimersRef.current = {};
        };
    }, [ticketId, isConnected, socket, queryClient, user?.id, onNewMessage, onStatusChange]);

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

        const handleListUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        };

        const handleNewTicket = (ticket: Ticket) => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            if (onNewTicketRef.current) {
                onNewTicketRef.current(ticket);
            }
        };

        const handleTicketUpdated = (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            if (onTicketUpdatedRef.current) {
                onTicketUpdatedRef.current(data);
            }
        };

        const handleNewMessage = (data: any) => {
            const ticketId = data.ticketId || data.message?.ticketId;
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            if (ticketId) {
                queryClient.setQueriesData({ queryKey: ['tickets'] }, (oldData: any) => {
                    if (!oldData) return oldData;
                    if (oldData.data && Array.isArray(oldData.data)) {
                        return {
                            ...oldData,
                            data: oldData.data.map((t: any) =>
                                t.id === ticketId
                                    ? { ...t, hasUnreadChat: true, unreadMessageCount: (t.unreadMessageCount || 0) + 1 }
                                    : t
                            ),
                        };
                    }
                    if (Array.isArray(oldData)) {
                        return oldData.map((t: any) =>
                            t.id === ticketId
                                ? { ...t, hasUnreadChat: true, unreadMessageCount: (t.unreadMessageCount || 0) + 1 }
                                : t
                        );
                    }
                    return oldData;
                });
            }
        };

        socket.on('tickets:listUpdated', handleListUpdate);
        socket.on('tickets:statusChanged', handleListUpdate);
        socket.on('ticket:assigned', handleListUpdate);
        socket.on('ticket:priority_changed', handleListUpdate);
        socket.on('ticket:created', handleNewTicket);
        socket.on('ticket:updated', handleTicketUpdated);
        socket.on('ticket:newMessage', handleNewMessage);
        socket.on('NEW_MESSAGE', handleNewMessage);
        socket.on('dashboard:stats:update', () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        });

        return () => {
            socket.off('tickets:listUpdated', handleListUpdate);
            socket.off('tickets:statusChanged', handleListUpdate);
            socket.off('ticket:assigned', handleListUpdate);
            socket.off('ticket:priority_changed', handleListUpdate);
            socket.off('ticket:created', handleNewTicket);
            socket.off('ticket:updated', handleTicketUpdated);
            socket.off('ticket:newMessage', handleNewMessage);
            socket.off('NEW_MESSAGE', handleNewMessage);
            socket.off('dashboard:stats:update');
        };
    }, [isConnected, socket, queryClient]);

    return { isConnected };
};
