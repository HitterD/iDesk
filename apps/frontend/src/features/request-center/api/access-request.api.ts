import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export enum AccessRequestStatus {
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    APPROVED = 'APPROVED',
    ACCESS_CREATED = 'ACCESS_CREATED',
    REJECTED = 'REJECTED',
}

export interface AccessRequest {
    id: string;
    ticketId?: string;
    requesterId: string;
    requester?: {
        id: string;
        fullName: string;
        email?: string;
    };
    accessType: string;
    systemName: string;
    reason: string;
    status: AccessRequestStatus;
    verifiedById?: string;
    verifiedAt?: string;
    approvedById?: string;
    approvedAt?: string;
    credentialsCreatedById?: string;
    credentialsCreatedAt?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt: string;
}

// Fetch all Access Requests
export const useAccessRequests = (filters?: { status?: AccessRequestStatus; requesterId?: string }) => {
    return useQuery<AccessRequest[]>({
        queryKey: ['access-requests', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.requesterId) params.append('requesterId', filters.requesterId);
            
            const res = await api.get(`/access-request?${params.toString()}`);
            return res.data;
        },
    });
};

// Verify Access Request
export const useVerifyAccessRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.patch(`/access-request/${id}/verify`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['access-requests'] });
        },
    });
};

// Approve Access Request
export const useApproveAccessRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.patch(`/access-request/${id}/approve`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['access-requests'] });
        },
    });
};

// Create Access Credentials
export const useCreateAccessCredentials = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await api.patch(`/access-request/${id}/create-access`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['access-requests'] });
        },
    });
};

// Reject Access Request
export const useRejectAccessRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const res = await api.patch(`/access-request/${id}/reject`, { reason });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['access-requests'] });
        },
    });
};
