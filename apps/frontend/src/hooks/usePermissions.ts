import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface FeaturePermission {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface FeatureDefinition {
    id: string;
    key: string;
    name: string;
    description?: string;
    category: string;
    icon?: string;
    appliesToRoles: string[];
    sortOrder: number;
}

export interface PermissionPreset {
    id: string;
    name: string;
    description?: string;
    permissions: Record<string, FeaturePermission>;
    isDefault: boolean;
    sortOrder: number;
}

/** Hook to fetch all feature definitions */
export function useFeatureDefinitions() {
    return useQuery<FeatureDefinition[]>({
        queryKey: ['feature-definitions'],
        queryFn: async () => {
            const res = await api.get('/permissions/features');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/** Hook to fetch permission presets */
export function usePermissionPresets() {
    return useQuery<PermissionPreset[]>({
        queryKey: ['permission-presets'],
        queryFn: async () => {
            const res = await api.get('/permissions/presets');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/** Hook to fetch a specific user's permissions (admin only) */
export function useUserPermissions(userId: string | undefined) {
    return useQuery({
        queryKey: ['user-permissions', userId],
        queryFn: async () => {
            const res = await api.get(`/permissions/users/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1 * 60 * 1000,
    });
}

/** Hook to check if current user has a specific permission */
export function useHasPermission(
    featureKey: string,
    action: 'view' | 'create' | 'edit' | 'delete' = 'view'
) {
    const authData = localStorage.getItem('auth');
    const user = authData ? JSON.parse(authData) : null;

    // ADMIN and MANAGER bypass permission checks
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        return { hasPermission: true, isLoading: false };
    }

    const { data: permissions, isLoading } = useQuery({
        queryKey: ['my-permissions', user?.userId],
        queryFn: async () => {
            const res = await api.get(`/permissions/users/${user?.userId}`);
            return res.data;
        },
        enabled: !!user?.userId && user?.role !== 'ADMIN' && user?.role !== 'MANAGER',
        staleTime: 5 * 60 * 1000,
    });

    if (isLoading) return { hasPermission: false, isLoading: true };

    const permission = permissions?.permissions?.[featureKey];
    if (!permission) return { hasPermission: false, isLoading: false };

    const hasPermission =
        action === 'view' ? permission.canView :
            action === 'create' ? permission.canCreate :
                action === 'edit' ? permission.canEdit :
                    action === 'delete' ? permission.canDelete : false;

    return { hasPermission, isLoading };
}

/** Hook to get all permissions for sidebar filtering */
export function useMyPermissions() {
    const authData = localStorage.getItem('auth');
    const user = authData ? JSON.parse(authData) : null;

    return useQuery({
        queryKey: ['my-permissions', user?.userId],
        queryFn: async () => {
            const res = await api.get(`/permissions/users/${user?.userId}`);
            return res.data;
        },
        enabled: !!user?.userId && user?.role !== 'ADMIN' && user?.role !== 'MANAGER',
        staleTime: 5 * 60 * 1000,
    });
}
