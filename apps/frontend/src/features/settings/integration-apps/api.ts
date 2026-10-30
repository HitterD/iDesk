import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AppColor } from '@/components/ui/ExternalSourceBadge';

/** Mirrors the backend APP_PERMISSIONS: what a connected app may do. */
export type AppPermission = 'tickets:create' | 'tickets:read' | 'messages:read' | 'messages:write';

export interface IntegrationApp {
    id: string;
    clientId: string;
    name: string;
    description: string | null;
    /** Source badge dot colour; null = derived from clientId. */
    color: AppColor | null;
    secretHint: string;
    modules: string[];
    permissions: AppPermission[];
    webhookUrl: string | null;
    isActive: boolean;
    lastUsedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface IntegrationAppInput {
    clientId?: string;
    name: string;
    description?: string | null;
    color?: AppColor | null;
    modules: string[];
    permissions: AppPermission[];
    webhookUrl?: string | null;
    isActive?: boolean;
}

/** A newly issued secret: shown once, never readable again. */
export interface IssuedSecret { app: IntegrationApp; secret: string }

export const PERMISSIONS: Array<{ value: AppPermission; label: string; hint: string }> = [
    { value: 'tickets:create', label: 'Buat tiket', hint: 'Mengirim tiket baru ke modul yang diizinkan' },
    { value: 'tickets:read', label: 'Lihat progres', hint: 'Status, PIC dan SLA tiket yang dibuat aplikasi ini' },
    { value: 'messages:read', label: 'Baca chat', hint: 'Percakapan publik tiket (catatan internal tidak pernah keluar)' },
    { value: 'messages:write', label: 'Balas chat', hint: 'Membalas atas nama NIK pemohon, pengirim, atau agen yang menangani' },
];

export const PERMISSION_LABEL = Object.fromEntries(PERMISSIONS.map((p) => [p.value, p.label])) as Record<AppPermission, string>;

/** Modules the ticket API can file into (others, e.g. HR, are not exposed). */
export const API_MODULES = ['it-support', 'oracle-k2', 'web-developer', 'mobile-developer'];

const KEY = ['admin', 'integration-apps'] as const;
const BASE = '/admin/integration-apps';

export function useIntegrationApps() {
    return useQuery({ queryKey: KEY, queryFn: async () => (await api.get<IntegrationApp[]>(BASE)).data });
}

export function useApiModules() {
    return useQuery({
        queryKey: ['ticket-modules', 'admin'],
        queryFn: async () => (await api.get<Array<{ slug: string; name: string; isActive: boolean }>>('/ticket-modules/admin')).data,
        select: (modules) => modules.filter((m) => m.isActive && API_MODULES.includes(m.slug)),
    });
}

export function useIntegrationAppMutations() {
    const queryClient = useQueryClient();
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: KEY });
        // Ticket source badges read names and colours from here.
        queryClient.invalidateQueries({ queryKey: ['integration-apps', 'sources'] });
    };
    return {
        create: useMutation({
            mutationFn: async (input: IntegrationAppInput) => (await api.post<IssuedSecret>(BASE, input)).data,
            onSuccess: refresh,
        }),
        update: useMutation({
            mutationFn: async ({ id, ...input }: Partial<IntegrationAppInput> & { id: string }) => (await api.patch<IntegrationApp>(`${BASE}/${id}`, input)).data,
            onSuccess: refresh,
        }),
        rotate: useMutation({
            mutationFn: async (id: string) => (await api.post<IssuedSecret>(`${BASE}/${id}/rotate-secret`)).data,
            onSuccess: refresh,
        }),
        remove: useMutation({
            mutationFn: async (id: string) => { await api.delete(`${BASE}/${id}`); },
            onSuccess: refresh,
        }),
    };
}

/** Public base URL partners call (same origin as this app, behind /api). */
export const apiBaseUrl = () => `${window.location.origin}/api/v1/integrations/apps`;
