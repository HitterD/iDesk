import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { CategorySettings } from '@/components/notifications/types/notification.types';
import { queryKeys } from '@/lib/queryKeys';

export function useCategorySettings() {
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery<CategorySettings>({
        queryKey: queryKeys.notifications.categorySettings(),
        queryFn: async () => {
            const response = await api.get('/notifications/preferences/categories');
            return response.data;
        },
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async (updates: Partial<CategorySettings>) => {
            const response = await api.patch('/notifications/preferences/categories', updates);
            return response.data;
        },
        onSuccess: (newSettings) => {
            queryClient.setQueryData(queryKeys.notifications.categorySettings(), newSettings);
            // Invalidate action items since they are filtered by these settings
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.actionItems() });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.legacyActionItems() });
        },
    });

    return {
        settings,
        isLoading,
        updateSettings: updateSettingsMutation.mutateAsync,
        isUpdating: updateSettingsMutation.isPending,
    };
}
