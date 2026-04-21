import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface IctBudgetActivity {
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    notes: string | null;
    createdAt: string;
    performedBy: {
        id: string;
        fullName: string;
        email: string;
    };
}

export const useIctBudgetActivities = (id: string) => {
    return useQuery<IctBudgetActivity[]>({
        queryKey: ['ict-budget-activities', id],
        queryFn: async () => {
            const res = await api.get(`/ict-budget/${id}/activities`);
            return res.data;
        },
        enabled: !!id,
    });
};
