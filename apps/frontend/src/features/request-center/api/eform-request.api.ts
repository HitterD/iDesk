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
  /** Running number, e.g. F/ICT/04-W/0007; set on submit, editable by ICT. */
  documentNumber?: string | null;
  /** Original name of the form the GM signed by hand, once ICT uploaded it. */
  gmApprovalFileName?: string | null;
  gmApprovedAt?: string | null;
  /** Whether the GM approves after the manager (VPN by default; ICT may switch it). */
  requiresGm?: boolean;
  /** GM who approves in iDesk; without one ICT uploads the paper-signed form. */
  gmApproverId?: string | null;
  gmApproverName?: string | null;
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
      managerId?: string;
      /** Optional GM who approves in iDesk; picking one turns the GM step on. */
      gmApproverId?: string;
      /** Completes a proposal IT drafted from a ticket instead of creating a new request. */
      draftId?: string;
    }) => {
      const { data } = await api.post(API_BASE, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

/** The manager approves with `manager-approve`; the chosen GM with `gm-approve`. Same body for both. */
export const useApproveByManager = (step: 'manager' | 'gm' = 'manager') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      signatureData?: string;
      rejectionReason?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.patch(`${API_BASE}/${id}/${step}-approve`, body);
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


export const useFulfillRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      notes: string;
      accountName?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.post(`${API_BASE}/${id}/fulfill`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
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

const saveBlob = async (path: string, fileName: string) => {
  const response = await api.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data as any]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadEformPdf = (id: string, fileName?: string) =>
  saveBlob(`${API_BASE}/${id}/pdf`, fileName || `EForm-VPN-${id}.pdf`);

/** The form as the GM signed it (uploaded by ICT). */
export const downloadGmApproval = (id: string, fileName?: string | null) =>
  saveBlob(`${API_BASE}/${id}/gm-approval`, fileName || `TTD-GM-${id}.pdf`);

const invalidateRequest = (queryClient: ReturnType<typeof useQueryClient>, id: string) => {
  queryClient.invalidateQueries({ queryKey: ['eform-request', id] });
  queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
};

/** ICT uploads the PDF the GM signed; the first upload moves the request on to provisioning. */
export const useUploadGmApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      // The panel words the failure itself (with the server's reason), so the global toast stays quiet.
      const { data } = await api.post(`${API_BASE}/${id}/gm-approval`, body, { skipToast: true });
      return data as EFormRequest;
    },
    onSuccess: (_, { id }) => invalidateRequest(queryClient, id),
  });
};

/** ICT turns the GM approval on or off and picks the GM (null: ICT uploads the paper-signed form). */
export const useSetGmStep = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, requiresGm, gmApproverId }: { id: string; requiresGm: boolean; gmApproverId: string | null }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/gm-step`, { requiresGm, gmApproverId }, { skipToast: true });
      return data as EFormRequest;
    },
    onSuccess: (_, { id }) => {
      invalidateRequest(queryClient, id);
      queryClient.invalidateQueries({ queryKey: ['eform-pending-approvals'] });
    },
  });
};

export const useUpdateDocumentNumber = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, documentNumber }: { id: string; documentNumber: string }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/document-number`, { documentNumber }, { skipToast: true });
      return data as EFormRequest;
    },
    onSuccess: (_, { id }) => invalidateRequest(queryClient, id),
  });
};

export const useGetEformPdf = (id: string) => {
  return async () => {
    await downloadEformPdf(id);
  };
};

export interface NasServer {
  id: 'JKT' | 'KRW' | 'SMG' | 'SPJ';
  name: string;
  location: string;
  host: string;
  port: number;
}

export interface NasFolderItem {
  name: string;
  path: string;
  isDir: boolean;
}

export interface NasBrowseResult {
  success: boolean;
  serverId: string;
  path?: string;
  folders: NasFolderItem[];
  message?: string;
}

export interface NasFolderRequestItem {
  nasId: 'JKT' | 'KRW' | 'SMG' | 'SPJ';
  nasName: string;
  folderPath: string;
  accessLevel: 'READ_ONLY' | 'READ_WRITE';
  isManualInput?: boolean;
  isAutoParent?: boolean;
}

export const useNasServers = () => {
  return useQuery<NasServer[]>({
    queryKey: ['eform-nas-servers'],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/nas/servers`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const browseNasFolders = async (serverId: string, path?: string): Promise<NasBrowseResult> => {
  const { data } = await api.post(`${API_BASE}/nas/browse`, { serverId, path });
  return data;
};

export interface NasSearchResult {
  success: boolean;
  serverId: string;
  query: string;
  count: number;
  folders: NasFolderItem[];
  message?: string;
}

export const searchNasFolders = async (serverId: string, query: string, maxDepth = 4): Promise<NasSearchResult> => {
  const { data } = await api.post(`${API_BASE}/nas/search`, { serverId, query, maxDepth });
  return data;
};

export interface NasCacheStatus {
  serverId: string;
  serverName: string;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  totalFolders: number;
}

export const getNasCacheStatus = async (serverId?: string): Promise<NasCacheStatus[]> => {
  const { data } = await api.get(`${API_BASE}/nas/status`, { params: serverId ? { serverId } : undefined });
  return Array.isArray(data) ? data : [];
};

export const triggerNasSync = async (
  serverId: string,
  force = false
): Promise<{ success: boolean; message: string; isSyncing: boolean }> => {
  const { data } = await api.post(`${API_BASE}/nas/sync`, { serverId, force });
  return data;
};



