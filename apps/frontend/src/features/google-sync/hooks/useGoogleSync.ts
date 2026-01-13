import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// Types
export interface SpreadsheetConfig {
    id: string;
    name: string;
    spreadsheetId: string;
    spreadsheetUrl?: string;
    isActive: boolean;
    lastSyncAt?: string;
    defaultSyncIntervalSeconds: number;
    sheets?: SpreadsheetSheet[];
    createdAt: string;
    updatedAt: string;
}

export interface SpreadsheetSheet {
    id: string;
    configId: string;
    sheetName: string;
    sheetGid?: string;
    dataType: 'RENEWAL' | 'VPN' | 'CUSTOM';
    syncDirection: 'PUSH' | 'PULL' | 'BOTH';
    columnMapping: ColumnMapping[];
    headerRow: number;
    dataStartRow: number;
    syncIntervalSeconds: number;
    syncEnabled: boolean;
    lastSyncAt?: string;
    lastSyncError?: string;
    syncErrorCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ColumnMapping {
    iDeskField: string;
    sheetColumn: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    required: boolean;
}

export interface SyncLog {
    id: string;
    sheetId: string;
    triggeredById?: string;
    direction: 'PUSH' | 'PULL';
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'CONFLICT';
    recordsCreated: number;
    recordsUpdated: number;
    recordsDeleted: number;
    recordsSkipped: number;
    conflictsResolved: number;
    errorMessage?: string;
    durationMs: number;
    syncedAt: string;
}

export interface SyncStatus {
    isAvailable: boolean;
    activeSpreadsheets: number;
    activeSyncSheets: number;
}

// Hooks
export function useGoogleSyncStatus() {
    return useQuery<SyncStatus>({
        queryKey: ['google-sync', 'status'],
        queryFn: async () => {
            const res = await api.get('/google-sync/status');
            return res.data;
        },
        staleTime: 30000,
    });
}

export function useSpreadsheetConfigs() {
    return useQuery<SpreadsheetConfig[]>({
        queryKey: ['google-sync', 'configs'],
        queryFn: async () => {
            const res = await api.get('/google-sync/configs');
            return res.data;
        },
    });
}

export function useSpreadsheetConfig(id: string) {
    return useQuery<SpreadsheetConfig>({
        queryKey: ['google-sync', 'configs', id],
        queryFn: async () => {
            const res = await api.get(`/google-sync/configs/${id}`);
            return res.data;
        },
        enabled: !!id,
    });
}

export function useSpreadsheetSheets(configId?: string) {
    return useQuery<SpreadsheetSheet[]>({
        queryKey: ['google-sync', 'sheets', configId],
        queryFn: async () => {
            const url = configId ? `/google-sync/sheets?configId=${configId}` : '/google-sync/sheets';
            const res = await api.get(url);
            return res.data;
        },
    });
}

export function useSyncLogs(sheetId?: string, limit = 50) {
    return useQuery<SyncLog[]>({
        queryKey: ['google-sync', 'logs', sheetId, limit],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (sheetId) params.append('sheetId', sheetId);
            params.append('limit', String(limit));
            const res = await api.get(`/google-sync/logs?${params}`);
            return res.data;
        },
    });
}

// Mutations
export function useCreateSpreadsheetConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { name: string; spreadsheetId: string; spreadsheetUrl?: string }) => {
            const res = await api.post('/google-sync/configs', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'configs'] });
        },
    });
}

export function useUpdateSpreadsheetConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<SpreadsheetConfig> }) => {
            const res = await api.put(`/google-sync/configs/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'configs'] });
        },
    });
}

export function useDeleteSpreadsheetConfig() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/google-sync/configs/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'configs'] });
        },
    });
}

export function useCreateSheetMapping() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: Partial<SpreadsheetSheet>) => {
            const res = await api.post('/google-sync/sheets', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'sheets'] });
        },
    });
}

export function useUpdateSheetMapping() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<SpreadsheetSheet> }) => {
            const res = await api.put(`/google-sync/sheets/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'sheets'] });
        },
    });
}

export function useTriggerSync() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (sheetId: string) => {
            const res = await api.post(`/google-sync/sheets/${sheetId}/sync`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'logs'] });
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'sheets'] });
        },
    });
}

export function useSyncNow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (sheetId: string) => {
            const res = await api.post(`/google-sync/sheets/${sheetId}/sync-now`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'logs'] });
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'sheets'] });
        },
    });
}

export function useTriggerSyncAll() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await api.post('/google-sync/sync-all');
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'logs'] });
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'sheets'] });
            queryClient.invalidateQueries({ queryKey: ['google-sync', 'status'] });
        },
    });
}

export function useDiscoverSheets(spreadsheetId: string) {
    return useQuery({
        queryKey: ['google-sync', 'discover', spreadsheetId],
        queryFn: async () => {
            const res = await api.get(`/google-sync/discover/${spreadsheetId}`);
            return res.data;
        },
        enabled: !!spreadsheetId && spreadsheetId.length > 10,
    });
}

export function useGetSheetHeaders(spreadsheetId: string, sheetName: string) {
    return useQuery({
        queryKey: ['google-sync', 'headers', spreadsheetId, sheetName],
        queryFn: async () => {
            const res = await api.get(`/google-sync/headers/${spreadsheetId}/${encodeURIComponent(sheetName)}`);
            return res.data.headers as string[];
        },
        enabled: !!spreadsheetId && !!sheetName,
    });
}
