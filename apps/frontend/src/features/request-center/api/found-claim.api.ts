import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum FoundClaimStatus {
    PENDING = 'PENDING',
    MATCHED = 'MATCHED',
    RETURNED = 'RETURNED',
    REJECTED = 'REJECTED',
}

export interface FoundItemClaim {
    id: string;
    finderId: string;
    finder?: { fullName: string; email: string };
    lostItemReportId?: string;
    lostItemReport?: { id: string; itemName: string; itemType: string; photoUrls: string[]; serialNumber?: string; lastSeenLocation?: string; reporter?: { fullName: string } };
    locationFound: string;
    foundAt: string;
    description: string;
    photoUrls: string[];
    status: FoundClaimStatus;
    managerNotes?: string;
    matchedBy?: { fullName: string };
    matchedAt?: string;
    createdAt: string;
}

export const useFoundClaims = (filters?: { status?: FoundClaimStatus }) =>
    useQuery<FoundItemClaim[]>({
        queryKey: ['found-claims', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            const res = await api.get(`/found-claim?${params}`);
            return res.data;
        },
    });

export const useFoundClaimsForReport = (lostItemReportId: string) =>
    useQuery<FoundItemClaim[]>({
        queryKey: ['found-claims', { lostItemReportId }],
        queryFn: async () => {
            const res = await api.get(`/found-claim?lostItemReportId=${lostItemReportId}`);
            return res.data;
        },
        enabled: !!lostItemReportId,
    });

export const useMyFoundClaims = () =>
    useQuery<FoundItemClaim[]>({
        queryKey: ['found-claims', 'my'],
        queryFn: async () => {
            const res = await api.get('/found-claim/my');
            return res.data;
        },
    });

export const useFoundClaim = (id: string) =>
    useQuery<FoundItemClaim>({
        queryKey: ['found-claim', id],
        queryFn: async () => {
            const res = await api.get(`/found-claim/${id}`);
            return res.data;
        },
        enabled: !!id,
    });

export const useCreateFoundClaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post('/found-claim', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
        },
    });
};

export const useMatchFoundClaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, lostItemReportId, notes }: { id: string; lostItemReportId?: string; notes?: string }) => {
            const res = await api.patch(`/found-claim/${id}/match`, { lostItemReportId, notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};

export const useRejectFoundClaim = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const res = await api.patch(`/found-claim/${id}/reject`, { notes });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
        },
    });
};

export const useConfirmReturn = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.patch(`/found-claim/${id}/returned`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['found-claims'] });
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};
