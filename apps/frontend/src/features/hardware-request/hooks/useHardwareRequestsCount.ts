import { useQuery } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';
import type { RequestStatus } from '../types';

const OPEN_STATUSES: RequestStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT',
  'AWAITING_DELIVERY', 'INSTALLATION',
];

export function useHardwareRequestsCount() {
  const query = useQuery({
    queryKey: ['hardware-requests', 'open-count'],
    queryFn: () => HardwareRequestApi.list({ status: OPEN_STATUSES, pageSize: 1 }),
    staleTime: 30_000,
  });
  const openCount = query.data?.meta?.total ?? 0;
  return { openCount, isLoading: query.isLoading };
}
