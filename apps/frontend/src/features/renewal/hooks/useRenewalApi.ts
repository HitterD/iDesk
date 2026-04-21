import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { RenewalContract, DashboardStats, UploadResult, ContractStatus, ContractCategory, UpdateContractDto, ContractAuditLog } from '../types/renewal.types';

// Paginated Response Type
export interface PaginatedContracts {
    items: RenewalContract[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Query Keys
export const renewalKeys = {
    all: ['renewal'] as const,
    list: (filters?: { status?: ContractStatus; category?: ContractCategory; search?: string; page?: number; limit?: number }) =>
        [...renewalKeys.all, 'list', filters] as const,
    stats: () => [...renewalKeys.all, 'stats'] as const,
    detail: (id: string) => [...renewalKeys.all, 'detail', id] as const,
    history: (id: string) => [...renewalKeys.all, 'history', id] as const,
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

export function useRenewalContracts(filters?: { status?: ContractStatus; category?: ContractCategory; search?: string; page?: number; limit?: number }) {
    return useQuery({
        queryKey: renewalKeys.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.set('status', filters.status);
            if (filters?.category) params.set('category', filters.category);
            if (filters?.search) params.set('search', filters.search);
            if (filters?.page) params.set('page', filters.page.toString());
            if (filters?.limit) params.set('limit', filters.limit.toString());

            const res = await api.get<PaginatedContracts>(`/renewal?${params}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData, // Keep previous data while loading
    });
}

export function useContractHistory(contractId: string) {
    return useQuery({
        queryKey: renewalKeys.history(contractId),
        queryFn: async () => {
            const res = await api.get<ContractAuditLog[]>(`/renewal/${contractId}/history`);
            return res.data;
        },
        enabled: !!contractId,
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
            return id;
        },
        // Optimistic update - remove from list immediately
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: renewalKeys.all });
            const previousData = queryClient.getQueriesData({ queryKey: renewalKeys.all });

            queryClient.setQueriesData<PaginatedContracts | undefined>(
                { queryKey: renewalKeys.all },
                (old) => {
                    if (!old?.items) return old;
                    return {
                        ...old,
                        items: old.items.filter((item: RenewalContract) => item.id !== id),
                        total: Math.max(0, (old.total || 0) - 1),
                    };
                }
            );
            return { previousData };
        },
        onError: (_, __, context) => {
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
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
        // Optimistic update
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: renewalKeys.all });
            const previousData = queryClient.getQueriesData({ queryKey: renewalKeys.all });

            // Optimistically update all list queries
            queryClient.setQueriesData<PaginatedContracts | undefined>(
                { queryKey: renewalKeys.all },
                (old) => {
                    if (!old?.items) return old;
                    return {
                        ...old,
                        items: old.items.map((item: RenewalContract) =>
                            item.id === id ? { ...item, isAcknowledged: true, acknowledgedAt: new Date().toISOString() } : item
                        ),
                    };
                }
            );
            return { previousData };
        },
        onError: (_, __, context) => {
            // Rollback on error
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: (_, __, id) => {
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
        // Optimistic update
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: renewalKeys.all });
            const previousData = queryClient.getQueriesData({ queryKey: renewalKeys.all });

            queryClient.setQueriesData<PaginatedContracts | undefined>(
                { queryKey: renewalKeys.all },
                (old) => {
                    if (!old?.items) return old;
                    return {
                        ...old,
                        items: old.items.map((item: RenewalContract) =>
                            item.id === id ? { ...item, isAcknowledged: false, acknowledgedAt: null } : item
                        ),
                    };
                }
            );
            return { previousData };
        },
        onError: (_, __, context) => {
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: (_, __, id) => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
            queryClient.invalidateQueries({ queryKey: renewalKeys.detail(id) });
        },
    });
}

// === BULK OPERATIONS ===
export function useBulkAcknowledge() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await api.post<{ affected: number }>('/renewal/bulk/acknowledge', { ids });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
        },
    });
}

export function useBulkDelete() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await api.post<{ affected: number }>('/renewal/bulk/delete', { ids });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: renewalKeys.all });
        },
    });
}

// === DUPLICATE CHECK ===
export function useCheckDuplicate() {
    return useMutation({
        mutationFn: async (poNumber: string) => {
            const res = await api.get<{ isDuplicate: boolean; existingContract?: RenewalContract }>(`/renewal/check-duplicate?poNumber=${encodeURIComponent(poNumber)}`);
            return res.data;
        },
    });
}
