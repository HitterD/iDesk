import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '@/lib/api';
import type { CalendarDay, ZoomAccount } from '../types';

interface AccountLoadSummary {
    id: string;
    name: string;
    colorHex: string;
    /** Total confirmed/pending bookings in the date range. */
    meetingsInRange: number;
    /**
     * Average daily load as a percentage. Capacity defaults to MAX_MEETINGS_PER_DAY.
     * Used by the account switcher to render a load bar without overloading the UI.
     */
    loadPercent: number;
}

const DEFAULT_CAPACITY_PER_DAY = 16; // ~ 8h × 2 slots (30 min) of fully-booked capacity.

/**
 * Aggregate meeting counts across a date range for every Zoom account in parallel.
 * Drives the "load %" indicator on the account switcher card.
 *
 * Performance: 1 network call per active account, run in parallel via React Query
 * `useQueries`. Stale time mirrors `useZoomCalendar` so updates flow through the
 * same socket invalidation path.
 */
export function useAccountLoadSummary(
    accounts: ZoomAccount[],
    startDate: string,
    endDate: string,
    enabled = true,
): AccountLoadSummary[] {
    const results = useQueries({
        queries: accounts.map((a) => ({
            queryKey: ['zoom-calendar-load', a.id, startDate, endDate] as const,
            queryFn: async () => {
                const params = new URLSearchParams({
                    zoomAccountId: a.id,
                    startDate,
                    endDate,
                });
                const response = await api.get(`/zoom-booking/calendar?${params}`);
                return response.data as CalendarDay[];
            },
            enabled: enabled && !!a.id && !!startDate && !!endDate,
            staleTime: 30000,
        })),
    });

    return useMemo(() => {
        const daySpan = Math.max(
            1,
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24) +
                1,
        );

        return accounts.map((a, i) => {
            const days = results[i]?.data;
            const meetingsInRange = days
                ? days.reduce((sum, day) => {
                      const seen = new Set<string>();
                      for (const slot of day.slots) {
                          // Trust `slot.booking` presence — slot.status can be inconsistent
                          // (e.g. 'available' or 'external' returned alongside a booking).
                          if (slot.booking && !seen.has(slot.booking.id)) {
                              seen.add(slot.booking.id);
                              sum += 1;
                          }
                      }
                      return sum;
                  }, 0)
                : 0;

            const capacity = DEFAULT_CAPACITY_PER_DAY * daySpan;
            const loadPercent = Math.min(100, Math.round((meetingsInRange / capacity) * 100));

            return {
                id: a.id,
                name: a.name,
                colorHex: a.colorHex ?? '#3b82f6',
                meetingsInRange,
                loadPercent,
            };
        });
    }, [accounts, results, startDate, endDate]);
}