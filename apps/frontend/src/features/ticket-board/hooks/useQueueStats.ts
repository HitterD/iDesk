import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export type StatsQueue = 'it-support' | 'oracle' | 'web-dev' | 'mobile-dev';

/** Stat card counts (GET /tickets/queue-stats), over the whole queue in the current scope, not one page. */
export interface QueueStats {
    total: number;
    open: number;
    inProgress: number;
    waitingVendor: number;
    resolved: number;
    overdue: number;
    critical: number;
}

const STATS_STALE_MS = 30_000;

/** Lives under 'dashboard-stats', so the ticket socket and every mutation refresh it like the IT Support stats. */
export function useQueueStats(queue: StatsQueue, scope: { siteIds: string[]; assignedToMe: boolean; createdByMe: boolean }) {
    return useQuery<QueueStats>({
        queryKey: ['dashboard-stats', 'queue', queue, scope],
        queryFn: async () => {
            const query = new URLSearchParams({ queue });
            if (scope.assignedToMe) query.append('assignedToMe', 'true');
            if (scope.createdByMe) query.append('createdByMe', 'true');
            scope.siteIds.forEach((siteId) => query.append('siteIds', siteId));
            return (await api.get(`/tickets/queue-stats?${query}`)).data;
        },
        staleTime: STATS_STALE_MS,
    });
}
