import { useLocation } from 'react-router-dom';

export const CSI_PATHS = {
    client: '/client/csi',
    manager: '/manager/csi',
    staff: '/csi',
} as const;

export type CsiBasePath = (typeof CSI_PATHS)[keyof typeof CSI_PATHS];

/** Respondent pages live under each portal's own layout; keep links inside the current one. */
export function csiBasePathFor(pathname: string): CsiBasePath {
    if (pathname === '/client' || pathname.startsWith('/client/')) return CSI_PATHS.client;
    if (pathname === '/manager' || pathname.startsWith('/manager/')) return CSI_PATHS.manager;
    return CSI_PATHS.staff;
}

export function useCsiBasePath(): CsiBasePath {
    return csiBasePathFor(useLocation().pathname);
}
