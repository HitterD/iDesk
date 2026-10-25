import { useAuth } from '@/stores/useAuth';
import { useMyPermissions } from '@/hooks/usePermissions';
import { CSI_ADMIN_PAGE_KEYS, CSI_ADMIN_ROLES, CSI_ADMIN_SCOPES } from './csiAdmin';
import type { CsiScopeParam } from '../types';

/** Role ADMIN/MANAGER and an explicit page key; ADMIN gets no bypass (backend `CsiAdminGuard` agrees). */
export function canAdminCsi(role: string | undefined, pageAccess: Record<string, boolean> | undefined, scope: CsiScopeParam) {
    return CSI_ADMIN_ROLES.includes(role ?? '') && pageAccess?.[CSI_ADMIN_PAGE_KEYS[scope]] === true;
}

export function useCsiAdminAccess() {
    const { user } = useAuth();
    const { data, isLoading, isError } = useMyPermissions();
    const pageAccess = (data as { pageAccess?: Record<string, boolean> } | undefined)?.pageAccess;
    const scopes: CsiScopeParam[] = CSI_ADMIN_SCOPES.filter((scope) => canAdminCsi(user?.role, pageAccess, scope));
    return { scopes, isLoading, isError };
}
