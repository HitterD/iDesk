import { useQueries } from '@tanstack/react-query';
import {
  fetchKpi,
  fetchStatusDistribution,
  fetchAgingBuckets,
  fetchTopCategories,
  fetchWeeklySchedule,
  fetchTechnicianWorkload,
  type DashboardFilters,
} from '../api/dashboard.api';

export type { DashboardFilters };

export function useDashboardData(filters: DashboardFilters = {}) {
  const results = useQueries({
    queries: [
      { queryKey: ['hardware-requests', 'dashboard', 'kpi', filters], queryFn: () => fetchKpi(filters), staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'status', filters], queryFn: () => fetchStatusDistribution(filters), staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'aging'], queryFn: fetchAgingBuckets, staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'topCategories', filters], queryFn: () => fetchTopCategories(filters), staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'weekly'], queryFn: fetchWeeklySchedule, staleTime: 60_000 },
      { queryKey: ['hardware-requests', 'dashboard', 'techWorkload'], queryFn: fetchTechnicianWorkload, staleTime: 60_000 },
    ],
  });

  const [kpi, status, aging, topCat, weekly, tech] = results;
  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error ?? null;

  return {
    kpi: kpi.data,
    statusDistribution: status.data,
    aging: aging.data,
    topCategories: topCat.data,
    weekly: weekly.data,
    technicianWorkload: tech.data,
    isLoading,
    error,
  };
}
