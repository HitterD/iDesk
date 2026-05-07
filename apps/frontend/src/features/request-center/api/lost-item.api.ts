import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum LostItemStatus {
    REPORTED = 'REPORTED',
    SEARCHING = 'SEARCHING',
    CLAIMED = 'CLAIMED',
    VERIFIED = 'VERIFIED',
    RETURNED = 'RETURNED',
    CLOSED_LOST = 'CLOSED_LOST',
}

export interface StatusLog {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedBy?: { fullName: string };
    notes?: string;
    timestamp: string;
}

export interface LostItemReport {
    id: string;
    ticketId?: string;
    itemName: string;
    itemType: string;
    serialNumber?: string;
    assetTag?: string;
    locationLost?: string;
    lastSeenLocation: string;
    lastSeenDatetime: string;
    description?: string;
    circumstances: string;
    status: LostItemStatus;
    photoUrls: string[];
    qrCodeUrl?: string;
    qrCodeToken?: string;
    foundAt?: string;
    foundLocation?: string;
    foundBy?: string;
    estimatedValue?: number;
    finderRewardOffered?: boolean;
    reporter?: { id: string; fullName: string; email?: string };
    ticket?: { user?: { fullName: string; email: string } };
    statusLogs?: StatusLog[];
    createdAt: string;
    updatedAt: string;
}

export const useLostItemReports = (filters?: { status?: LostItemStatus; reporterId?: string }) =>
    useQuery<LostItemReport[]>({
        queryKey: ['lost-item-reports', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.reporterId) params.append('reporterId', filters.reporterId);
            const res = await api.get(`/lost-item?${params}`);
            return res.data;
        },
    });

export const useMyLostReports = () =>
    useQuery<LostItemReport[]>({
        queryKey: ['lost-item-reports', 'my'],
        queryFn: async () => {
            const res = await api.get('/lost-item/my');
            return res.data;
        },
    });

export const useLostItemReport = (id: string) =>
    useQuery<LostItemReport>({
        queryKey: ['lost-item-report', id],
        queryFn: async () => {
            const res = await api.get(`/lost-item/${id}`);
            return res.data;
        },
        enabled: !!id,
    });

export const useQrTokenReport = (token: string | null) =>
    useQuery<{ reportId: string; itemName: string; itemType: string; photoUrls: string[] }>({
        queryKey: ['lost-item-qr', token],
        queryFn: async () => {
            const res = await api.get(`/lost-item/qr/${token}`);
            return res.data;
        },
        enabled: !!token,
    });

export const useCreateLostItem = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post('/lost-item', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lost-item-reports'] });
        },
    });
};

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

export const getByQrToken = async (token: string) => {
    const res = await api.get(`/lost-item/qr/${token}`);
    return res.data;
};

export const useUploadPoliceReport = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
            const res = await api.post(`/lost-item/${id}/police-report`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['lost-item', id] });
        },
    });
};
