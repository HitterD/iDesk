import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { NotificationCategory } from '@/components/notifications/types/notification.types';
import { NOTIFICATIONS_READ_EVENT, useMarkNotificationsRead, useNotificationsReadSync } from '../useMarkNotificationsRead';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));

const handlers = new Map<string, () => void>();
const fakeSocket = {
    on: vi.fn((event: string, handler: () => void) => handlers.set(event, handler)),
    off: vi.fn((event: string) => handlers.delete(event)),
};
vi.mock('@/lib/socket', () => ({ useSocket: () => ({ socket: fakeSocket, isConnected: true }) }));

const setup = () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { wrapper, invalidate };
};

beforeEach(() => {
    vi.mocked(api.post).mockReset();
    handlers.clear();
});

describe('useMarkNotificationsRead', () => {
    it('marks the opened ticket as read and refreshes the bell', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { updated: 2 } });
        const { wrapper, invalidate } = setup();

        renderHook(() => useMarkNotificationsRead({ ticketId: 't-1' }), { wrapper });

        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] }));
        expect(api.post).toHaveBeenCalledWith('/notifications/read-by-target', { ticketId: 't-1' }, { skipToast: true });
    });

    it('does not call the server again when re-rendered with an equal target', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { updated: 0 } });
        const { wrapper } = setup();

        const { rerender } = renderHook(
            () => useMarkNotificationsRead({ category: NotificationCategory.CATEGORY_ZOOM }),
            { wrapper },
        );
        rerender();

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    });

    it('waits until the id is known', () => {
        const { wrapper } = setup();

        renderHook(() => useMarkNotificationsRead(null), { wrapper });

        expect(api.post).not.toHaveBeenCalled();
    });
});

describe('useNotificationsReadSync', () => {
    it('refreshes notifications when another tab reads them', () => {
        const { wrapper, invalidate } = setup();
        renderHook(() => useNotificationsReadSync(), { wrapper });

        handlers.get(NOTIFICATIONS_READ_EVENT)?.();

        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    });
});
