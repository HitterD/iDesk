import { useQuery } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';

export function useHardwareStats(scope?: 'my' | 'all') {
    return useQuery({
        queryKey: ['hardware-requests', 'stats', scope],
        queryFn: async () => {
            const [totalRes, reviewRes, inProgRes, doneRes] = await Promise.all([
                HardwareRequestApi.list({ pageSize: 1, scope }),
                HardwareRequestApi.list({ status: ['SUBMITTED', 'UNDER_REVIEW'], pageSize: 1, scope }),
                HardwareRequestApi.list({ status: ['APPROVED', 'PROCUREMENT', 'AWAITING_DELIVERY', 'INSTALLATION', 'AWAITING_USER_CONFIRMATION'], pageSize: 1, scope }),
                HardwareRequestApi.list({ status: ['COMPLETED'], pageSize: 1, scope }),
            ]);
            return {
                total: totalRes.meta?.total ?? 0,
                review: reviewRes.meta?.total ?? 0,
                inProgress: inProgRes.meta?.total ?? 0,
                completed: doneRes.meta?.total ?? 0,
            };
        },
        staleTime: 20_000,
    });
}
