import { useQuery } from '@tanstack/react-query';
import { ActivityApi } from '../api/activity.api';

export const useActivity = (requestId: string | undefined) =>
    useQuery({
        queryKey: ['activity', requestId],
        queryFn: () => ActivityApi.list(requestId!),
        enabled: !!requestId,
        staleTime: 10_000,
    });
