import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface PublicZoomSettings {
    slotStartTime: string;
    slotEndTime: string;
    slotIntervalMinutes: number;
    workingDays: number[];
    advanceBookingDays: number;
    allowedDurations: number[];
}

const STALE_TIME = 60_000;

export function useZoomSettings(enabled = true) {
    return useQuery<PublicZoomSettings>({
        queryKey: ['zoom-public-settings'],
        queryFn: async () => {
            const res = await api.get('/zoom-booking/settings');
            return res.data;
        },
        enabled,
        staleTime: STALE_TIME,
    });
}

export function isWorkingDay(date: Date, workingDays: number[]): boolean {
    return workingDays.includes(date.getDay());
}
