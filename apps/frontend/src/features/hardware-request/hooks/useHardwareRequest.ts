import { useQuery } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';

export const useHardwareRequest = (id: string | undefined) =>
    useQuery({
        queryKey: ['hardware-requests', 'detail', id],
        queryFn: () => HardwareRequestApi.byId(id!),
        enabled: !!id,
        staleTime: 10_000,
    });
