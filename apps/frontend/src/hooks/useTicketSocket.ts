import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/lib/socket';

interface Message {
    id: string;
    content: string;
    senderId: string;
    sender?: { fullName: string; role: string };
    createdAt: string;
    isSystemMessage?: boolean;
    attachments?: string[];
}

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
                // Optimistically update the cache
                queryClient.setQueryData(['ticket', ticketId], (oldData: any) => {
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
                queryClient.setQueryData(['ticket', ticketId], (oldData: any) => {
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
export const useTicketListSocket = (options?: { onNewTicket?: (ticket: any) => void }) => {
    const { socket, isConnected } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isConnected) return;

        const handleListUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        };

        const handleStatusChange = () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        };

        const handleNewTicket = (ticket: any) => {
            // Refresh ticket list immediately
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

            // Call custom handler if provided
            if (options?.onNewTicket) {
                options.onNewTicket(ticket);
            }
        };

        const handleDashboardStatsUpdate = () => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        };

        socket.on('tickets:listUpdated', handleListUpdate);
        socket.on('tickets:statusChanged', handleStatusChange);
        socket.on('ticket:created', handleNewTicket);
        socket.on('dashboard:stats:update', handleDashboardStatsUpdate);

        return () => {
            socket.off('tickets:listUpdated', handleListUpdate);
            socket.off('tickets:statusChanged', handleStatusChange);
            socket.off('ticket:created', handleNewTicket);
            socket.off('dashboard:stats:update', handleDashboardStatsUpdate);
        };
    }, [isConnected, socket, queryClient, options?.onNewTicket]);

    return { isConnected };
};
