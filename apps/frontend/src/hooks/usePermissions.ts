import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';

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
    targetRole?: 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN';
    pageAccess?: PageAccess;
    permissions: Record<string, FeaturePermission>;
    isDefault: boolean;
    sortOrder: number;
}

// NEW: Simple page access map
export interface PageAccess {
    [pageKey: string]: boolean;
}

// Response from GET /permissions/me
export interface MyPermissionsResponse {
    userId: string;
    permissions: Record<string, any>;
    pageAccess: PageAccess;
    appliedPreset: {
        presetId: string | null;
        presetName: string | null;
    };
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
        staleTime: 30 * 1000, // 30 seconds - ensures newly added presets are visible quickly
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
    const { user } = useAuth();

    // ADMIN bypasses permission checks
    if (user?.role === 'ADMIN') {
        return { hasPermission: true, isLoading: false };
    }

    const { data: permissions, isLoading } = useQuery({
        queryKey: ['my-permissions'],
        queryFn: async () => {
            // Use /permissions/me endpoint - works for ALL roles
            const res = await api.get('/permissions/me');
            return res.data;
        },
        enabled: !!user?.id || !!(user as any)?.userId,
        staleTime: 30 * 1000,
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
    const { user } = useAuth();

    return useQuery({
        queryKey: ['my-permissions'],
        queryFn: async () => {
            // Use /permissions/me endpoint - works for ALL roles
            const res = await api.get('/permissions/me');
            return res.data;
        },
        enabled: !!user?.id || !!(user as any)?.userId,
        staleTime: 5 * 60 * 1000, // 5 minutes - optimal for performance while still enforcing security logs
    });
}

/**
 * V9: Hook to check if current user has access to a specific page
 * Uses preset pageAccess for authorization
 */
export function useHasPageAccess(pageKey: string) {
    const { user } = useAuth();

    // ADMIN bypasses page access checks
    if (user?.role === 'ADMIN') {
        return { hasAccess: true, isLoading: false, isError: false };
    }

    const { data: permissions, isLoading, isError } = useQuery<MyPermissionsResponse>({
        queryKey: ['my-permissions'],
        queryFn: async () => {
            const res = await api.get('/permissions/me');
            return res.data;
        },
        enabled: !!user?.id || !!(user as any)?.userId,  // FIXED: was user?.id, Zustand stores userId not id
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    if (isLoading) return { hasAccess: false, isLoading: true, isError: false };

    // If query failed (network error etc.), do NOT redirect to unauthorized
    // Return isError=true so caller can show a retry/error state instead
    if (isError) return { hasAccess: false, isLoading: false, isError: true };

    // Check pageAccess from preset
    const hasAccess = permissions?.pageAccess?.[pageKey] === true;

    return { hasAccess, isLoading: false, isError: false };
}

/**
 * FI-7: Hook to check if current user has specific feature-level CRUD permission
 * Uses preset permissions for granular access control
 * 
 * Usage:
 * const canCreate = useHasFeaturePermission('tickets', 'create');
 * const canDelete = useHasFeaturePermission('kb', 'delete');
 */
export function useHasFeaturePermission(feature: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
    const { user } = useAuth();

    // ADMIN bypasses feature access checks
    if (user?.role === 'ADMIN') {
        return true;
    }

    const { data: permissions } = useQuery<MyPermissionsResponse>({
        queryKey: ['my-permissions'],
        queryFn: async () => {
            const res = await api.get('/permissions/me');
            return res.data;
        },
        enabled: !!user?.id || !!(user as any)?.userId,  // FIXED: was user?.id, Zustand stores userId not id
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    // Check feature permission from preset's permissions object
    // Format: permissions.permissions['feature.action'].canAction
    const featureKey = `${feature}.${action}`;
    const actionMap: Record<string, keyof FeaturePermission> = {
        view: 'view',
        create: 'create',
        edit: 'edit',
        delete: 'delete',
    };

    const featurePermission = permissions?.permissions?.[featureKey];
    return featurePermission?.[actionMap[action]] === true;
}
