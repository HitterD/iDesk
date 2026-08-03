import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

export interface AvailabilityResult {
    available: boolean;
    reason?: string;
}

export function useCheckAvailability(
    date: string | undefined,
    startTime: string | undefined,
    durationMinutes: number | undefined,
) {
    const debouncedDate = useDebounce(date, 400);
    const debouncedStartTime = useDebounce(startTime, 400);
    const debouncedDuration = useDebounce(durationMinutes, 400);

    return useQuery<AvailabilityResult>({
        queryKey: ['zoom-availability', debouncedDate, debouncedStartTime, debouncedDuration],
        queryFn: async () => {
            const params = new URLSearchParams({
                date: debouncedDate!,
                startTime: debouncedStartTime!,
                durationMinutes: String(debouncedDuration!),
            });
            const response = await api.get(`/zoom-booking/availability?${params}`);
            return response.data;
        },
        enabled: Boolean(debouncedDate && debouncedStartTime && debouncedDuration),
        staleTime: 0,
    });
}
