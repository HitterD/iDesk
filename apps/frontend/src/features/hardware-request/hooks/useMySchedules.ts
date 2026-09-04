import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import type { CalendarEventResponse } from '../api/installation.api';

export function useMySchedules(range: { from: string; to: string }) {
  const query = useQuery({
    queryKey: ['hardware-requests', 'my-schedules', range],
    queryFn: async () => {
      const q = new URLSearchParams({
        from: range.from,
        to: range.to,
      });
      const { data } = await api.get<{ data: CalendarEventResponse[] }>(`/hardware-requests/my-schedules?${q}`);
      return data.data;
    },
    staleTime: 30_000,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    error: query.error,
  };
}
