import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface DaySlotAvailability {
    time: string;
    endTime: string;
    available: boolean;
    availableAccountsCount: number;
    totalAccountsCount: number;
    reason?: string;
    exceedsOperatingHours?: boolean;
}

export interface DaySlotsAvailabilityResponse {
    date: string;
    durationMinutes: number;
    isWorkingDay: boolean;
    isBlocked: boolean;
    isPast: boolean;
    isFutureExceeded: boolean;
    totalAccounts: number;
    availableSlotsCount: number;
    totalSlotsCount: number;
    isFullyBooked: boolean;
    reason?: string;
    slots: DaySlotAvailability[];
}

export function useDaySlotsAvailability(
    date: string | undefined,
    durationMinutes: number | undefined = 60,
) {
    return useQuery<DaySlotsAvailabilityResponse>({
        queryKey: ['zoom-day-slots-availability', date, durationMinutes],
        queryFn: async () => {
            const params = new URLSearchParams({
                date: date!,
                durationMinutes: String(durationMinutes || 60),
            });
            const response = await api.get(`/zoom-booking/availability/slots?${params}`);
            return response.data;
        },
        enabled: Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date)),
        staleTime: 15_000,
    });
}
