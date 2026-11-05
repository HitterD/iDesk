import { useAuth } from '@/stores/useAuth';
import { useMyPermissions } from '@/hooks/usePermissions';
import { CSI_ADMIN_PAGE_KEYS, CSI_ADMIN_ROLES, CSI_ADMIN_SCOPES } from './csiAdmin';
import type { CsiScopeParam } from '../types';

/**
 * Mirrors backend `canAdminCsiScope`: HC_ADMIN = HC only; ADMIN = HC always, ICT with the page key;
 * MANAGER = the scope's page key.
 */
export function canAdminCsi(role: string | undefined, pageAccess: Record<string, boolean> | undefined, scope: CsiScopeParam) {
    if (role === 'HC_ADMIN') return scope === 'hc';
    if (role === 'ADMIN' && scope === 'hc') return true;
    return CSI_ADMIN_ROLES.includes(role ?? '') && role !== 'HC_ADMIN' && pageAccess?.[CSI_ADMIN_PAGE_KEYS[scope]] === true;
}

export function useCsiAdminAccess() {
    const { user } = useAuth();
    const { data, isLoading, isError } = useMyPermissions();
    const pageAccess = (data as { pageAccess?: Record<string, boolean> } | undefined)?.pageAccess;
    const scopes: CsiScopeParam[] = CSI_ADMIN_SCOPES.filter((scope) => canAdminCsi(user?.role, pageAccess, scope));
    return { scopes, isLoading, isError };
}
