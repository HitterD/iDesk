import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CalendarDay, ZoomAccount } from '../types';

/**
 * Fetch calendar data for ALL active Zoom accounts in a single HTTP call.
 *
 * Replaces the previous N parallel `/calendar` requests, which tripped the
 * backend throttler (429) once the active account count climbed. Uses the
 * dedicated `POST /calendar/batch` endpoint which runs a single SQL query
 * and returns `{ [accountId]: CalendarDay[] }`.
 *
 * Used by Gabungan mode to determine which accounts are free at a given
 * date+time so the form can auto-fall-back to the next available account
 * (zoom 1 → zoom 2 → ... → zoom 10) when one is already booked.
 */
export function useAllAccountsAvailability(
    accounts: ZoomAccount[],
    date: string | undefined,
    enabled = true,
): Record<string, CalendarDay[] | undefined> {
    const accountIds = accounts.map((a) => a.id);

    const query = useQuery({
        queryKey: ['zoom-calendar-batch', accountIds, date] as const,
        queryFn: async () => {
            const response = await api.post('/zoom-booking/calendar/batch', {
                accountIds,
                startDate: date,
                endDate: date,
            });
            return (response.data ?? {}) as Record<string, CalendarDay[]>;
        },
        enabled: enabled && !!date && accountIds.length > 0,
        staleTime: 30000,
    });

    return query.data ?? {};
}