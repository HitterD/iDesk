import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { RenewalContract, DashboardStats, UploadResult, ContractStatus, UpdateContractDto } from '../types/renewal.types';

// Query Keys
export const renewalKeys = {
    all: ['renewal'] as const,
    list: (filters?: { status?: ContractStatus; search?: string }) =>
        [...renewalKeys.all, 'list', filters] as const,
    stats: () => [...renewalKeys.all, 'stats'] as const,
    detail: (id: string) => [...renewalKeys.all, 'detail', id] as const,
};

// === FETCH HOOKS ===
export function useRenewalStats() {
    return useQuery({
        queryKey: renewalKeys.stats(),
        queryFn: async () => {
            const res = await api.get<DashboardStats>('/renewal/stats');
            return res.data;
        },
    });
}

export function useRenewalContracts(filters?: { status?: ContractStatus; search?: string }) {
    return useQuery({
        queryKey: renewalKeys.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.set('status', filters.status);
            if (filters?.search) params.set('search', filters.search);

            const res = await api.get<RenewalContract[]>(`/renewal?${params}`);
            return res.data;
        },
    });
}

export function useRenewalContract(id: string) {
    return useQuery({
        queryKey: renewalKeys.detail(id),
        queryFn: async () => {
            const res = await api.get<RenewalContract>(`/renewal/${id}`);
            return res.data;
        },
        enabled: !!id,
    });
}

// === MUTATION HOOKS ===
export function useUploadContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ file, forceUpload = false }: { file: File; forceUpload?: boolean }) => {
            const formData = new FormData();
            formData.append('file', file);

            const url = forceUpload ? '/renewal/upload?forceUpload=true' : '/renewal/upload';
            const res = await api.post<UploadResult>(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: (data) => {
            // Only invalidate if it was a successful upload (not a warning)
            if (!('success' in data && data.success === false)) {
                queryClient.invalidateQueries({ queryKey: renewalKeys.all });
            }
        },
    });
}

export function useUpdateContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateContractDto }) => {
            const res = await api.patch<RenewalContract>(`/renewal/${id}`, data);
            return res.data;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
            queryClient.invalidateQueries({ queryKey: renewalKeys.detail(id) });
        },
    });
}

export function useDeleteContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/renewal/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
        },
    });
}

export function useCreateManualContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateContractDto) => {
            const res = await api.post<RenewalContract>('/renewal/manual', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
        },
    });
}

// === ACKNOWLEDGE HOOKS ===
export function useAcknowledgeContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.post<RenewalContract>(`/renewal/${id}/acknowledge`);
            return res.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
            queryClient.invalidateQueries({ queryKey: renewalKeys.detail(id) });
        },
    });
}

export function useUnacknowledgeContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.post<RenewalContract>(`/renewal/${id}/unacknowledge`);
            return res.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
            queryClient.invalidateQueries({ queryKey: renewalKeys.detail(id) });
        },
    });
}
