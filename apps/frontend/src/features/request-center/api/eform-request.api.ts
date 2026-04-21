import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const API_BASE = '/eform-request';

export interface EFormRequest {
  id: string;
  formType: string;
  status: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterJobTitle?: string;
  requesterDepartment?: string;
  formData: any;
  requestedWebsites?: string;
  networkPurpose?: string;
  termsAccepted: boolean;
  rejectionReason?: string;
  currentApproverId?: string;
  submittedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  signatures?: any[];
  approvals?: any[];
}

export const useEformRequests = (all = false) => {
  return useQuery<EFormRequest[]>({
    queryKey: ['eform-requests', all],
    queryFn: async () => {
      const endpoint = all ? `${API_BASE}/all` : `${API_BASE}/my`;
      const { data } = await api.get(endpoint);
      return Array.isArray(data) ? data : [];
    },
  });
};

export const usePendingApprovals = () => {
  return useQuery<EFormRequest[]>({
    queryKey: ['eform-pending-approvals'],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/pending-approvals`);
      return Array.isArray(data) ? data : [];
    },
  });
};

export const useVpnTerms = () => {
  return useQuery<{ terms: string }>({
    queryKey: ['eform-vpn-terms'],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/terms`);
      return data;
    },
  });
};

export const useUpdateVpnTerms = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (terms: string) => {
      const { data } = await api.patch(`${API_BASE}/terms`, { terms });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eform-vpn-terms'] });
    },
  });
};

export const useEformDetail = (id: string) => {
  return useQuery<EFormRequest>({
    queryKey: ['eform-request', id],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateEformRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post(API_BASE, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useApproveManager1 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; signatureData: string; nextApproverId?: string }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/manager1-approve`, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useApproveManager2 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, signatureData }: { id: string; signatureData: string }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/manager2-approve`, { signatureData });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useConfirmIct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; username: string; password: string }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/ict-confirm`, payload);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useRejectRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/reject`, { reason });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useGetCredentialsSecure = (id: string) => {
  return useQuery({
    queryKey: ['eform-credentials', id],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/${id}/credentials`);
      return data;
    },
    enabled: false, // Manual trigger only
  });
};

export const useGetEformPdf = (id: string) => {
  return async () => {
    const response = await api.get(`${API_BASE}/${id}/pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EForm-VPN-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
};
