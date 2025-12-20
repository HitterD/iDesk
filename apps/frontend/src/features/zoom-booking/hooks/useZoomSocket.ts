import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4050';

interface ZoomSocketEvents {
    'booking:created': (data: any) => void;
    'booking:cancelled': (data: { bookingId: string; reason?: string }) => void;
    'booking:updated': (data: any) => void;
    'calendar:updated': (data: { accountId: string; action: string }) => void;
    'settings:updated': (data: { timestamp: string }) => void;
}

/**
 * Hook for real-time Zoom calendar updates via Socket.IO
 * Automatically invalidates React Query cache when updates are received
 */
export function useZoomSocket(accountId?: string) {
    const queryClient = useQueryClient();
    const socketRef = useRef<Socket | null>(null);

    // Handle calendar update
    const handleCalendarUpdate = useCallback((data: { accountId: string; action: string }) => {
        // Invalidate calendar queries to refetch
        queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
        queryClient.invalidateQueries({ queryKey: ['admin-zoom-bookings'] });

        // Show toast for visibility
        if (data.action === 'created') {
            toast.info('📅 New booking added to calendar');
        } else if (data.action === 'cancelled') {
            toast.info('📅 Booking cancelled');
        }
    }, [queryClient]);

    // Handle settings update
    const handleSettingsUpdate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['zoom-settings'] });
        queryClient.invalidateQueries({ queryKey: ['zoom-accounts'] });
        toast.info('⚙️ Settings updated');
    }, [queryClient]);

    // Handle booking created (for specific account)
    const handleBookingCreated = useCallback((data: any) => {
        queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
    }, [queryClient]);

    // Handle booking cancelled
    const handleBookingCancelled = useCallback((data: { bookingId: string; reason?: string }) => {
        queryClient.invalidateQueries({ queryKey: ['zoom-calendar'] });
    }, [queryClient]);

    useEffect(() => {
        // Connect to Zoom namespace
        const socket = io(`${SOCKET_URL}/zoom`, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('🔌 Connected to Zoom WebSocket');

            // Subscribe to specific account if provided
            if (accountId) {
                socket.emit('subscribe:account', accountId);
            }
        });

        socket.on('disconnect', () => {
            console.log('🔌 Disconnected from Zoom WebSocket');
        });

        // Register event handlers
        socket.on('calendar:updated', handleCalendarUpdate);
        socket.on('settings:updated', handleSettingsUpdate);
        socket.on('booking:created', handleBookingCreated);
        socket.on('booking:cancelled', handleBookingCancelled);

        return () => {
            // Unsubscribe from account
            if (accountId) {
                socket.emit('unsubscribe:account', accountId);
            }
            socket.disconnect();
        };
    }, [accountId, handleCalendarUpdate, handleSettingsUpdate, handleBookingCreated, handleBookingCancelled]);

    // Manual subscribe/unsubscribe methods
    const subscribeToAccount = useCallback((newAccountId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('subscribe:account', newAccountId);
        }
    }, []);

    const unsubscribeFromAccount = useCallback((oldAccountId: string) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('unsubscribe:account', oldAccountId);
        }
    }, []);

    return {
        subscribeToAccount,
        unsubscribeFromAccount,
        isConnected: socketRef.current?.connected ?? false,
    };
}
