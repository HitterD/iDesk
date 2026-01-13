import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// Types
export interface VpnAccess {
    id: string;
    username: string;
    fullName: string;
    email?: string;
    department?: string;
    site?: string;
    vpnType: 'SITE_TO_SITE' | 'CLIENT' | 'SSL';
    vpnProfile?: string;
    validFrom: string;
    validUntil: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING';
    purpose?: string;
    requestedById?: string;
    approvedById?: string;
    reminderDays: string;
    lastReminderSent?: string;
    isAcknowledged: boolean;
    acknowledgedById?: string;
    acknowledgedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface VpnStats {
    total: number;
    active: number;
    expired: number;
    expiringSoon: number;
    byType: Record<string, number>;
}

export interface VpnFilters {
    status?: string;
    vpnType?: string;
    site?: string;
    search?: string;
}

// Hooks
export function useVpnAccessList(filters?: VpnFilters) {
    return useQuery<VpnAccess[]>({
        queryKey: ['vpn-access', 'list', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.vpnType) params.append('vpnType', filters.vpnType);
            if (filters?.site) params.append('site', filters.site);
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

export function useVpnExpiring(days = 30) {
    return useQuery<VpnAccess[]>({
        queryKey: ['vpn-access', 'expiring', days],
        queryFn: async () => {
            const res = await api.get(`/vpn-access/expiring?days=${days}`);
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

export function useAcknowledgeVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.post(`/vpn-access/${id}/acknowledge`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}

export function useRevokeVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.post(`/vpn-access/${id}/revoke`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}

export function useRenewVpnAccess() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, validUntil }: { id: string; validUntil: Date }) => {
            const res = await api.post(`/vpn-access/${id}/renew`, { validUntil });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vpn-access'] });
        },
    });
}
