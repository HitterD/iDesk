import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AgentDashboardData, AgentDashboardPeriod } from './agentDashboard.types';

const STALE_TIME_MS = 30_000;

/**
 * Keyed under 'dashboard-stats' so the ticket socket's existing
 * 'dashboard:stats:update' invalidation refreshes it too.
 */
export const agentDashboardQueryKey = (agentId: string | undefined, days: AgentDashboardPeriod) =>
    ['dashboard-stats', 'agent', agentId ?? 'me', days] as const;

/** Own dashboard when `agentId` is undefined, otherwise the given agent's (ADMIN/MANAGER). */
export function useAgentDashboard(agentId: string | undefined, days: AgentDashboardPeriod) {
    return useQuery<AgentDashboardData>({
        queryKey: agentDashboardQueryKey(agentId, days),
        queryFn: async () => {
            const url = agentId ? `/agent-dashboard/agents/${agentId}` : '/agent-dashboard/me';
            return (await api.get(url, { params: { days } })).data;
        },
        staleTime: STALE_TIME_MS,
        refetchOnWindowFocus: true,
    });
}
