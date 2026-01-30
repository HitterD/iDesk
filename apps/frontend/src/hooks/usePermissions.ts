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
        enabled: !!user?.userId,
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
    const authData = localStorage.getItem('auth');
    const user = authData ? JSON.parse(authData) : null;

    return useQuery({
        queryKey: ['my-permissions'],
        queryFn: async () => {
            // Use /permissions/me endpoint - works for ALL roles
            const res = await api.get('/permissions/me');
            return res.data;
        },
        enabled: !!user?.userId,
        staleTime: 30 * 1000, // 30 seconds - faster refresh after preset changes
    });
}

/**
 * V9: Hook to check if current user has access to a specific page
 * Uses preset pageAccess for authorization
 */
export function useHasPageAccess(pageKey: string) {
    // CRITICAL FIX: Zustand uses 'auth-storage' key, not 'auth'
    // Also Zustand wraps state in { state: { user: ... } }
    const authData = localStorage.getItem('auth-storage');
    let user = null;
    if (authData) {
        try {
            const parsed = JSON.parse(authData);
            user = parsed?.state?.user;
        } catch {
            user = null;
        }
    }

    // ADMIN bypasses page access checks
    if (user?.role === 'ADMIN') {
        return { hasAccess: true, isLoading: false };
    }

    const { data: permissions, isLoading } = useQuery<MyPermissionsResponse>({
        queryKey: ['my-permissions'],
        queryFn: async () => {
            const res = await api.get('/permissions/me');
            return res.data;
        },
        enabled: !!user?.id,
        staleTime: 30 * 1000,
    });

    if (isLoading) return { hasAccess: false, isLoading: true };

    // Check pageAccess from preset
    const hasAccess = permissions?.pageAccess?.[pageKey] === true;

    return { hasAccess, isLoading };
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
    // CRITICAL FIX: Zustand uses 'auth-storage' key
    const authData = localStorage.getItem('auth-storage');
    let user = null;
    if (authData) {
        try {
            const parsed = JSON.parse(authData);
            user = parsed?.state?.user;
        } catch {
            user = null;
        }
    }

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
        enabled: !!user?.id,
        staleTime: 30 * 1000,
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
