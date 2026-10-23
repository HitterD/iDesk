import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { NotificationCategory } from '@/components/notifications/types/notification.types';
import { NOTIFICATIONS_READ_EVENT, useMarkNotificationsRead, useNotificationsReadSync } from '../useMarkNotificationsRead';

vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));

const handlers = new Map<string, (payload?: unknown) => void>();
const fakeSocket = {
    on: vi.fn((event: string, handler: (payload?: unknown) => void) => handlers.set(event, handler)),
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

    it('marks a notification read when it arrives while its page is open', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { updated: 1 } });
        const { wrapper } = setup();
        renderHook(() => useMarkNotificationsRead({ ticketId: 't-1' }), { wrapper });
        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

        // A reply about another ticket is left alone; one about this ticket is read at once (once, despite two events).
        handlers.get('notification:u-1')?.({ id: 'n-2', ticketId: 't-9', isRead: false });
        handlers.get('notification:u-1')?.({ id: 'n-3', ticketId: 't-1', isRead: false });
        handlers.get('notification:new')?.({ userId: 'u-1', notification: { id: 'n-3', ticketId: 't-1', isRead: false } });

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
        expect(api.post).toHaveBeenLastCalledWith('/notifications/read-by-target', { ticketId: 't-1' }, { skipToast: true });
    });

    it('matches hardware step references to their request', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { updated: 1 } });
        const { wrapper } = setup();
        renderHook(() => useMarkNotificationsRead({ referenceId: 'hw-1' }), { wrapper });
        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));

        handlers.get('notification:u-1')?.({ id: 'n-4', referenceId: 'hw-1_APPROVAL', isRead: false });

        await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
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
