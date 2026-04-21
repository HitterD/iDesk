import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum LostItemStatus {
    REPORTED = 'REPORTED',
    FOUND = 'FOUND',
    LOST = 'LOST',
}

export interface LostItemReport {
    id: string;
    ticketId?: string;
    reporterId: string;
    reporter?: {
        id: string;
        fullName: string;
        email?: string;
    };
    itemName: string;
    itemType: string;
    locationLost: string;
    description: string;
    status: LostItemStatus;
    foundById?: string;
    foundAt?: string;
    createdAt: string;
    updatedAt: string;
}

// Fetch all Lost Item Reports
export const useLostItemReports = (filters?: { status?: LostItemStatus; reporterId?: string }) => {
    return useQuery<LostItemReport[]>({
        queryKey: ['lost-item-reports', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.reporterId) params.append('reporterId', filters.reporterId);
            
            const res = await api.get(`/lost-item?${params.toString()}`);
            return res.data;
        },
    });
};

// Update Lost Item Status
export const useUpdateLostItemStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status, notes }: { id: string; status: LostItemStatus; notes?: string }) => {
            const res = await api.patch(`/lost-item/${id}/status`, { status, notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};
