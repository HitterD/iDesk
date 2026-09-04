import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useAuth } from '@/stores/useAuth';
import { ActionItemsResponse } from '../../../components/notifications/types/action-item.types';

import { queryKeys } from '@/lib/queryKeys';

export const useActionItems = () => {
    const { user } = useAuth();
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    const { data, isLoading, isFetching, error, refetch } = useQuery<ActionItemsResponse>({
        queryKey: queryKeys.notifications.actionItems(),
        queryFn: async () => {
            const res = await api.get('/notifications/action-items');
            return res.data;
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
        refetchInterval: 60000, // Poll every 60s as per spec
        refetchIntervalInBackground: false, // Pause polling when tab is inactive to save CPU/network
        refetchOnWindowFocus: true, // Instantly refresh when returning to this tab
    });

    // Invalidate on socket events
    useEffect(() => {
        if (!socket || !user) return;

        const handleRefresh = () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.actionItems() });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.legacyActionItems() });
        };

        socket.on(`notification:${user.id}`, handleRefresh);
        socket.on(`notification:acknowledged:${user.id}`, handleRefresh);
        socket.on(`action-items:refresh:${user.id}`, handleRefresh);

        return () => {
            socket.off(`notification:${user.id}`, handleRefresh);
            socket.off(`notification:acknowledged:${user.id}`, handleRefresh);
            socket.off(`action-items:refresh:${user.id}`, handleRefresh);
        };
    }, [socket, user, queryClient]);

    const allItems = data?.items || [];
    const activeItems = allItems.filter(i => !i.isSnoozed);

    return {
        items: allItems,
        activeItems,
        counts: data?.counts || { critical: 0, high: 0, normal: 0, total: 0 },
        isLoading,
        isFetching,
        error,
        refetch
    };
};
