import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import { ActionItemsResponse } from '../../../components/notifications/types/action-item.types';

export const useActionItems = () => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    const { data, isLoading, error, refetch } = useQuery<ActionItemsResponse>({
        queryKey: ['action-items'],
        queryFn: async () => {
            const res = await api.get('/notifications/action-items');
            return res.data;
        },
        enabled: !!user,
        refetchInterval: 60000, // Poll every 60s as per spec
    });

    // Invalidate on socket events
    useEffect(() => {
        if (!socket || !user) return;

        const handleSocketEvent = () => {
            queryClient.invalidateQueries({ queryKey: ['action-items'] });
        };

        socket.on(`notification:${user.id}`, handleSocketEvent);
        socket.on(`notification:acknowledged:${user.id}`, handleSocketEvent);
        // Assuming other entity updates might trigger these or similar events

        return () => {
            socket.off(`notification:${user.id}`, handleSocketEvent);
            socket.off(`notification:acknowledged:${user.id}`, handleSocketEvent);
        };
    }, [socket, user, queryClient]);

    return {
        items: data?.items || [],
        counts: data?.counts || { critical: 0, high: 0, normal: 0, total: 0 },
        isLoading,
        error,
        refetch
    };
};
