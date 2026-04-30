import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ActionItemEntityType } from '@/components/notifications/types/action-item.types';

interface SnoozeVariables {
    entityType: ActionItemEntityType;
    entityId: string;
    duration: string; // e.g., '1h', 'tomorrow', 'next_week'
}

interface UnsnoozeVariables {
    entityType: ActionItemEntityType;
    entityId: string;
}

export function useSnoozeActionItem() {
    const queryClient = useQueryClient();

    const snoozeMutation = useMutation({
        mutationFn: async (variables: SnoozeVariables) => {
            const response = await api.post('/notifications/action-items/snooze', variables);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['actionItems'] });
        },
    });

    const unsnoozeMutation = useMutation({
        mutationFn: async (variables: UnsnoozeVariables) => {
            const response = await api.delete('/notifications/action-items/snooze', { data: variables });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['actionItems'] });
        },
    });

    return {
        snooze: snoozeMutation.mutateAsync,
        isSnoozing: snoozeMutation.isPending,
        unsnooze: unsnoozeMutation.mutateAsync,
        isUnsnoozing: unsnoozeMutation.isPending,
    };
}
