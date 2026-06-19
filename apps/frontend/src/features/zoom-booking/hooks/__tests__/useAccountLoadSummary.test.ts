import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAccountLoadSummary } from '../useAccountLoadSummary';
import api from '@/lib/api';
import type { CalendarDay, ZoomAccount } from '../../types';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
    },
}));
const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

const accounts: ZoomAccount[] = [
    { id: 'acc-1', name: 'Marketing', colorHex: '#f00' } as unknown as ZoomAccount,
];

function makeDay(bookings: Array<{ id: string; status: string }>): CalendarDay {
    return {
        date: '2026-06-19',
        dayOfWeek: 5,
        isWorkingDay: true,
        isBlocked: false,
        slots: bookings.map((b, i) => ({
            date: '2026-06-19',
            time: `${8 + i}:00`,
            endTime: `${9 + i}:00`,
            status: b.status as 'booked' | 'my_booking' | 'available' | 'blocked' | 'external',
            booking: {
                id: b.id,
                title: `mtg-${b.id}`,
                bookedBy: 'user-1',
                durationMinutes: 60,
                startTime: `${8 + i}:00`,
                endTime: `${9 + i}:00`,
            },
        })),
    };
}

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useAccountLoadSummary', () => {
    beforeEach(() => {
        mockedApi.get.mockReset();
    });

    it('counts 2 meetings on 1 day as loadPercent 13 (2/16) regardless of slot.status', async () => {
        // Bug repro: bookings present but slot.status not in the old filter's
        // whitelist ('booked' | 'my_booking'). The fix must trust slot.booking.
        mockedApi.get.mockResolvedValue({
            data: [
                makeDay([
                    { id: 'b1', status: 'available' },
                    { id: 'b2', status: 'external' },
                ]),
            ],
        });

        const { result } = renderHook(
            () => useAccountLoadSummary(accounts, '2026-06-19', '2026-06-19'),
            { wrapper: makeWrapper() },
        );
        await waitFor(
            () => {
                expect(result.current[0]?.meetingsInRange).toBe(2);
            },
            { timeout: 3000 },
        );
        expect(result.current[0].loadPercent).toBe(13);
    });

    it('counts 0 meetings as loadPercent 0', async () => {
        mockedApi.get.mockResolvedValue({ data: [makeDay([])] });

        const { result } = renderHook(
            () => useAccountLoadSummary(accounts, '2026-06-19', '2026-06-19'),
            { wrapper: makeWrapper() },
        );
        // Wait for query to settle (mock called) before asserting.
        await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
        expect(result.current[0].meetingsInRange).toBe(0);
        expect(result.current[0].loadPercent).toBe(0);
    });

    it('deduplicates recurring booking across slots (counted once)', async () => {
        const day = makeDay([
            { id: 'recurring-1', status: 'booked' },
            { id: 'recurring-1', status: 'booked' },
        ]);
        mockedApi.get.mockResolvedValue({ data: [day] });

        const { result } = renderHook(
            () => useAccountLoadSummary(accounts, '2026-06-19', '2026-06-19'),
            { wrapper: makeWrapper() },
        );
        await waitFor(
            () => {
                expect(result.current[0]?.meetingsInRange).toBe(1);
            },
            { timeout: 3000 },
        );
    });
});
