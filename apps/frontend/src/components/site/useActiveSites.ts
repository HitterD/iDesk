import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const SITES_STALE_MS = 5 * 60 * 1000;

const asSites = (data: unknown): Site[] => Array.isArray(data) ? data : [];

/** Active sites shared by site pickers; falls back to `/sites` where `/sites/active` is not allowed. */
export function useActiveSites() {
    return useQuery<Site[]>({
        queryKey: ['sites', 'active'],
        queryFn: async () => {
            try {
                return asSites((await api.get('/sites/active')).data);
            } catch (err) {
                const status = (err as { response?: { status?: number } }).response?.status;
                if (status === HTTP_FORBIDDEN || status === HTTP_NOT_FOUND) return asSites((await api.get('/sites')).data);
                throw err;
            }
        },
        staleTime: SITES_STALE_MS,
        refetchOnWindowFocus: false,
    });
}
