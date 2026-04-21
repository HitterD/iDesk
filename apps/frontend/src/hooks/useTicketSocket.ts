import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';
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
    const queryClient = useQueryClient();
    const [typingUsers, setTypingUsers] = useState<{ [key: string]: string }>({});

    // Join ticket room when connected
    useEffect(() => {
        if (!ticketId || !isConnected) return;

        // Join the ticket room
        socket.emit('join:ticket', ticketId);

        // Listen for new messages
        const handleNewMessage = (data: { ticketId: string; message: Message }) => {
            if (data.ticketId === ticketId) {
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

        // Typing indicators
        const handleTypingStart = (data: { ticketId: string; user: { fullName: string }; socketId: string }) => {
            if (data.ticketId === ticketId) {
                setTypingUsers(prev => ({ ...prev, [data.socketId]: data.user.fullName }));
            }
        };

        const handleTypingStop = (data: { ticketId: string; socketId: string }) => {
            if (data.ticketId === ticketId) {
                setTypingUsers(prev => {
                    const newState = { ...prev };
                    delete newState[data.socketId];
                    return newState;
                });
            }
        };

        socket.on('ticket:newMessage', handleNewMessage);
        socket.on('ticket:statusChanged', handleStatusChange);
        socket.on('ticket:updated', handleTicketUpdate);
        socket.on('typing:start', handleTypingStart);
        socket.on('typing:stop', handleTypingStop);

        // Cleanup
        return () => {
            socket.emit('leave:ticket', ticketId);
            socket.off('ticket:newMessage', handleNewMessage);
            socket.off('ticket:statusChanged', handleStatusChange);
            socket.off('ticket:updated', handleTicketUpdate);
            socket.off('typing:start', handleTypingStart);
            socket.off('typing:stop', handleTypingStop);
        };
    }, [ticketId, isConnected, socket, queryClient, onNewMessage, onStatusChange]);

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

        socket.on('tickets:listUpdated', handleListUpdate);
        socket.on('tickets:statusChanged', handleListUpdate);
        socket.on('ticket:assigned', handleListUpdate);
        socket.on('ticket:priority_changed', handleListUpdate);
        socket.on('ticket:created', handleNewTicket);
        socket.on('ticket:updated', handleTicketUpdated);
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
            socket.off('dashboard:stats:update');
        };
    }, [isConnected, socket, queryClient]);

    return { isConnected };
};
