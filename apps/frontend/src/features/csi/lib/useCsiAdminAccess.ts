import { useAuth } from '@/stores/useAuth';
import { useMyPermissions } from '@/hooks/usePermissions';
import { useCsiMyReportAccess } from '../hooks/useCsiHc';
import { CSI_ADMIN_PAGE_KEYS, CSI_ADMIN_ROLES, CSI_ADMIN_SCOPES } from './csiAdmin';
import type { CsiScopeParam } from '../types';

/**
 * Mirrors backend `canAdminCsiScope`: HC_ADMIN = HC only; ADMIN = HC always, ICT with the page key;
 * MANAGER = the scope's page key. Only these accounts may change CSI data.
 */
export function canAdminCsi(role: string | undefined, pageAccess: Record<string, boolean> | undefined, scope: CsiScopeParam) {
    if (role === 'HC_ADMIN') return scope === 'hc';
    if (role === 'ADMIN' && scope === 'hc') return true;
    return CSI_ADMIN_ROLES.includes(role ?? '') && role !== 'HC_ADMIN' && pageAccess?.[CSI_ADMIN_PAGE_KEYS[scope]] === true;
}

/** Mirrors backend `canReadCsiScope`: writers, any ADMIN/MANAGER, and the report owners of the scope (read-only). */
export function canReadCsi(role: string | undefined, pageAccess: Record<string, boolean> | undefined, scope: CsiScopeParam, isOwner: boolean) {
    if (canAdminCsi(role, pageAccess, scope) || isOwner) return true;
    return role !== 'HC_ADMIN' && (role === 'ADMIN' || role === 'MANAGER');
}

export function useCsiAdminAccess() {
    const { user } = useAuth();
    const { data, isLoading, isError } = useMyPermissions();
    const hcOwner = useCsiMyReportAccess('hc');
    const ictOwner = useCsiMyReportAccess('ict');
    const pageAccess = (data as { pageAccess?: Record<string, boolean> } | undefined)?.pageAccess;
    const ownerOf: Record<CsiScopeParam, boolean> = {
        hc: (hcOwner.data?.services.length ?? 0) > 0, ict: (ictOwner.data?.services.length ?? 0) > 0,
    };
    const readable = CSI_ADMIN_SCOPES.filter((scope) => canReadCsi(user?.role, pageAccess, scope, ownerOf[scope]));
    // Scopes the account can change come first (they are the fallback landing), read-only ones after.
    const scopes: CsiScopeParam[] = [
        ...readable.filter((scope) => canAdminCsi(user?.role, pageAccess, scope)),
        ...readable.filter((scope) => !canAdminCsi(user?.role, pageAccess, scope)),
    ];
    const readOnly = (scope: CsiScopeParam) => !canAdminCsi(user?.role, pageAccess, scope);
    return { scopes, readOnly, isLoading: isLoading || hcOwner.isLoading || ictOwner.isLoading, isError };
}
