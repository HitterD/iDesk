import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Notification, NotificationCategory, NotificationCountByCategory, PaginatedResponse } from '@/components/notifications/types/notification.types';

type FilterValue = 'all' | 'unread' | 'read';

export const useNotificationQueries = ({
    activeCategory,
    readFilter,
    page = 1,
    limit = 20
}: {
    activeCategory?: NotificationCategory;
    readFilter: FilterValue;
    page?: number;
    limit?: number;
}) => {
    const queryClient = useQueryClient();

    // 1. Fetch main notifications list
    const { data, isLoading, isFetching } = useQuery<PaginatedResponse<Notification>>({
        queryKey: ['notifications', 'center', activeCategory, readFilter, page, limit],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (activeCategory) params.set('category', activeCategory);
            if (readFilter === 'unread') params.set('isRead', 'false');
            if (readFilter === 'read') params.set('isRead', 'true');
            params.set('page', page.toString());
            params.set('limit', limit.toString());

            const res = await api.get(`/notifications?${params}`);
            return res.data;
        },
        staleTime: 30000,
    });

    // 2. Fetch category counts
    const { data: categoryCounts } = useQuery<NotificationCountByCategory>({
        queryKey: ['notifications', 'count', 'by-category'],
        queryFn: async () => {
            const res = await api.get('/notifications/count/by-category');
            return res.data;
        },
        staleTime: 30000,
    });

    const { data: totalCategoryCounts } = useQuery<NotificationCountByCategory>({
        queryKey: ['notifications', 'count', 'total-by-category'],
        queryFn: async () => {
            const res = await api.get('/notifications/count/total-by-category');
            return res.data;
        },
        staleTime: 30000,
    });

    // 3. Mutations for Single Items
    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const deleteNotificationMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/notifications/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // 4. Bulk Mutations
    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await api.post('/notifications/read-all');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await api.post('/notifications/bulk-delete', { ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const bulkMarkAsReadMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await api.post('/notifications/bulk-read', { ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    return {
        notifications: data?.data || [],
        total: data?.total || 0,
        isLoading,
        isFetching,
        categoryCounts,
        totalCategoryCounts,
        markAsReadMutation,
        markAllAsReadMutation,
        deleteNotificationMutation,
        bulkDeleteMutation,
        bulkMarkAsReadMutation,
    };
};
