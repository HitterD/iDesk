import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { HardwareRequestApi } from '../api/hardware-request.api';
import type { ListFilters } from '../types';

export const useHardwareRequestList = (filters: ListFilters) =>
    useQuery({
        queryKey: ['hardware-requests', 'list', filters],
        queryFn: () => HardwareRequestApi.list(filters),
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });
