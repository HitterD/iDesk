import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Notification } from '@/components/notifications/types/notification.types';

export function useUnacknowledgedCritical() {
    const queryClient = useQueryClient();

    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ['unacknowledgedCritical'],
        queryFn: async () => {
            const response = await api.get('/notifications/critical/unacknowledged');
            return response.data;
        },
    });

    const acknowledgeMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await api.post(`/notifications/${id}/acknowledge`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unacknowledgedCritical'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notificationCounts'] });
        },
    });

    return {
        notifications,
        isLoading,
        acknowledge: acknowledgeMutation.mutateAsync,
        isAcknowledging: acknowledgeMutation.isPending,
    };
}
