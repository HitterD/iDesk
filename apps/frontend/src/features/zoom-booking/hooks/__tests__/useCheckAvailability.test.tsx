import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCheckAvailability } from '../useCheckAvailability';

vi.mock('@/lib/api', () => ({
    default: { get: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useCheckAvailability', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
    });

    it('does not fetch when booking fields are incomplete', () => {
        const { result } = renderHook(
            () => useCheckAvailability(undefined, '10:00', 60),
            { wrapper },
        );

        expect(result.current.data).toBeUndefined();
        expect(api.get).not.toHaveBeenCalled();
    });

    it('fetches availability when all booking fields are present', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { available: true } });
        const { result } = renderHook(
            () => useCheckAvailability('2026-08-01', '10:00', 60),
            { wrapper },
        );

        await waitFor(() => expect(result.current.data).toEqual({ available: true }));
        expect(api.get).toHaveBeenCalledWith(
            '/zoom-booking/availability?date=2026-08-01&startTime=10%3A00&durationMinutes=60',
        );
    });
});
