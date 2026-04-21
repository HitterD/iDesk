import { useQuery } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';

const OPEN_STATUSES = [
  'SUBMITTED', 'REVIEW', 'APPROVED', 'PROCUREMENT',
  'AWAITING_DELIVERY', 'INSTALLATION',
] as const;

export function useHardwareRequestsCount() {
  const query = useQuery({
    queryKey: ['hardware-requests', 'open-count'],
    queryFn: () => HardwareRequestApi.list({ status: OPEN_STATUSES as unknown as string[], limit: 1 }),
    staleTime: 30_000,
  });
  const openCount = query.data?.meta?.total ?? 0;
  return { openCount, isLoading: query.isLoading };
}
