import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// Types
export interface VpnAccess {
    id: string;
    area: 'Karawang' | 'Jakarta' | 'Sepanjang' | 'Semarang';
    namaUser: string;
    emailUser?: string;
    tanggalAktif: string;
    tanggalNonAktif: string;
    statusCreateVpn: 'Selesai' | 'Proses' | 'Batal' | 'Non Aktif';
    keteranganNonAktifVpn?: string;
    statusUserH1?: string;
    statusIctH1?: string;
    requestedById?: string;
    approvedById?: string;
    createdAt: string;
    updatedAt: string;
}

export interface VpnStats {
    total: number;
    active: number;
    expired: number;
    expiringSoon: number;
    byArea: Record<string, number>;
}

export interface VpnFilters {
    statusCreateVpn?: string;
    area?: string;
    search?: string;
}

// Hooks
export function useVpnAccessList(filters?: VpnFilters) {
    return useQuery<VpnAccess[]>({
        queryKey: ['vpn-access', 'list', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.statusCreateVpn) params.append('statusCreateVpn', filters.statusCreateVpn);
            if (filters?.area) params.append('area', filters.area);
            if (filters?.search) params.append('search', filters.search);
            const res = await api.get(`/vpn-access?${params}`);
            return res.data;
        },
    });
}

export function useVpnAccess(id: string) {
    return useQuery<VpnAccess>({
        queryKey: ['vpn-access', id],
        queryFn: async () => {
            const res = await api.get(`/vpn-access/${id}`);
            return res.data;
        },
        enabled: !!id,
    });
}

export function useVpnStats() {
    return useQuery<VpnStats>({
        queryKey: ['vpn-access', 'stats'],
        queryFn: async () => {
            const res = await api.get('/vpn-access/stats');
            return res.data;
        },
    });
}

// Mutations
export function useCreateVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<VpnAccess>) => {
            const res = await api.post('/vpn-access', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}

export function useUpdateVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<VpnAccess> }) => {
            const res = await api.put(`/vpn-access/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}

export function useDeleteVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/vpn-access/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}

export function useBulkDeleteVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids: string[]) => {
            const res = await api.post('/vpn-access/bulk-delete', { ids });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}
