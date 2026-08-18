import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const API_BASE = '/eform-request';

export interface EFormSignature {
  id: string;
  signerName: string;
  signatureData: string;
  signerRole: string;
  signedAt: string;
}

export interface EFormRequest {
  id: string;
  formType: string;
  status: string;
  requesterId: string;
  requesterName: string;
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
  signatures?: EFormSignature[];
  approvals?: any[];
}

export interface EFormCredentials {
  username: string;
  password: string;
  vpnServer?: string;
  notes?: string;
  provisionedAt?: string;
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
    refetchInterval: 30_000, // Poll every 30s so managers see new requests without refresh
    staleTime: 15_000,
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
    refetchOnMount: 'always',
    staleTime: 0,
  });
};

export const useCreateEformRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      formType: string;
      requesterName?: string;
      requesterDepartment?: string;
      formData: any;
      requestedWebsites?: string;
      networkPurpose?: string;
      termsAccepted: boolean;
      signatureData: string;
      managerId: string;
    }) => {
      const { data } = await api.post(API_BASE, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useApproveByManager = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      signatureData?: string;
      rejectionReason?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.patch(`${API_BASE}/${id}/manager-approve`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
      queryClient.invalidateQueries({ queryKey: ['eform-pending-approvals'] });
    },
  });
};

export const useSubmitCredentials = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      username: string;
      password: string;
      vpnServer?: string;
      notes?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.post(`${API_BASE}/${id}/credentials`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-credentials', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useGetCredentials = (id: string, enabled = false) => {
  return useQuery<EFormCredentials>({
    queryKey: ['eform-credentials', id],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/${id}/credentials`);
      return data;
    },
    enabled: enabled && !!id,
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

export const downloadEformPdf = async (id: string, fileName?: string) => {
  const response = await api.get(`${API_BASE}/${id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data as any]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName || `EForm-VPN-${id}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const useGetEformPdf = (id: string) => {
  return async () => {
    await downloadEformPdf(id);
  };
};

