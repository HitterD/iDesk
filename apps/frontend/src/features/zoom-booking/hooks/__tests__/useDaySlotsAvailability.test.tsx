import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDaySlotsAvailability } from '../useDaySlotsAvailability';

vi.mock('@/lib/api', () => ({
    default: { get: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useDaySlotsAvailability', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
    });

    it('does not fetch when date is undefined or invalid format', () => {
        const { result } = renderHook(
            () => useDaySlotsAvailability(undefined, 60),
            { wrapper },
        );

        expect(result.current.data).toBeUndefined();
        expect(api.get).not.toHaveBeenCalled();
    });

    it('fetches slots availability when valid date is provided', async () => {
        const mockResponse = {
            date: '2026-09-04',
            durationMinutes: 60,
            isWorkingDay: true,
            isBlocked: false,
            isPast: false,
            isFutureExceeded: false,
            totalAccounts: 10,
            availableSlotsCount: 16,
            totalSlotsCount: 20,
            isFullyBooked: false,
            slots: [
                { time: '08:00', endTime: '09:00', available: true, availableAccountsCount: 5, totalAccountsCount: 10 },
            ],
        };

        vi.mocked(api.get).mockResolvedValue({ data: mockResponse });
        const { result } = renderHook(
            () => useDaySlotsAvailability('2026-09-04', 60),
            { wrapper },
        );

        await waitFor(() => expect(result.current.data).toEqual(mockResponse));
        expect(api.get).toHaveBeenCalledWith(
            '/zoom-booking/availability/slots?date=2026-09-04&durationMinutes=60',
        );
    });
});
