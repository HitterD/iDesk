import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { CategorySettings } from '@/components/notifications/types/notification.types';

export function useCategorySettings() {
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery<CategorySettings>({
        queryKey: ['notificationCategorySettings'],
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
            queryClient.setQueryData(['notificationCategorySettings'], newSettings);
            // Invalidate action items since they are filtered by these settings
            queryClient.invalidateQueries({ queryKey: ['actionItems'] });
        },
    });

    return {
        settings,
        isLoading,
        updateSettings: updateSettingsMutation.mutateAsync,
        isUpdating: updateSettingsMutation.isPending,
    };
}
