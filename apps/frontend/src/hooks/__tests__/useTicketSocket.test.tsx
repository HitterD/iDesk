import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const handlers = new Map<string, Array<(payload?: any) => void>>();

const socket = {
    connected: true,
    on: vi.fn((event: string, handler: (payload?: any) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        return socket;
    }),
    off: vi.fn((event: string, handler: (payload?: any) => void) => {
        handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== handler));
        return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => socket),
}));

const apiPost = vi.fn(() => Promise.resolve({ data: undefined }));
vi.mock('@/lib/api', () => ({ default: { post: (...args: unknown[]) => apiPost(...(args as [])) } }));

vi.mock('@/stores/useAuth', () => ({
    useAuth: vi.fn(() => ({
        user: { id: 'agent-123', fullName: 'Agent Bagas', role: 'ADMIN' },
    })),
}));

const fire = (event: string, payload?: any) => {
    act(() => {
        (handlers.get(event) ?? []).forEach((handler) => handler(payload));
    });
};

const { useTicketSocket, useTicketListSocket, LIST_INVALIDATE_DEBOUNCE_MS, TICKET_RESYNC_DEBOUNCE_MS } = await import('../useTicketSocket');

describe('useTicketSocket', () => {
    let queryClient: QueryClient;

    const createWrapper = () => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        return ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
    };

    beforeEach(() => {
        vi.useFakeTimers();
        handlers.clear();
        vi.clearAllMocks();
        socket.connected = true;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('joins ticket room immediately on mount if connected', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), {
            wrapper: createWrapper(),
        });

        expect(socket.emit).toHaveBeenCalledWith('join:ticket', 'ticket-1');
    });

    it('auto-rejoins ticket room on every socket connect/reconnect event', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), {
            wrapper: createWrapper(),
        });

        expect(socket.emit).toHaveBeenCalledWith('join:ticket', 'ticket-1');
        (socket.emit as any).mockClear();

        // Simulate reconnect
        fire('connect');

        expect(socket.emit).toHaveBeenCalledWith('join:ticket', 'ticket-1');
    });

    it('sets typing user on typing:start and auto-expires after 3.5s (eliminating ghost typing)', () => {
        const { result } = renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), {
            wrapper: createWrapper(),
        });

        expect(result.current.typingUsers).toEqual({});

        // User starts typing
        fire('typing:start', {
            ticketId: 'ticket-1',
            user: { fullName: 'Amelia Yolanda' },
            socketId: 'sock-amelia',
        });

        expect(result.current.typingUsers).toEqual({
            'sock-amelia': 'Amelia Yolanda',
        });

        // Fast-forward 3.4 seconds (still typing)
        act(() => {
            vi.advanceTimersByTime(3400);
        });
        expect(result.current.typingUsers).toEqual({
            'sock-amelia': 'Amelia Yolanda',
        });

        // Fast-forward past 3.5s -> auto-expired!
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current.typingUsers).toEqual({});
    });

    it('clears typing user immediately on typing:stop', () => {
        const { result } = renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), {
            wrapper: createWrapper(),
        });

        fire('typing:start', {
            ticketId: 'ticket-1',
            user: { fullName: 'Amelia Yolanda' },
            socketId: 'sock-amelia',
        });

        expect(result.current.typingUsers).toEqual({
            'sock-amelia': 'Amelia Yolanda',
        });

        // User stops typing explicitly
        fire('typing:stop', {
            ticketId: 'ticket-1',
            socketId: 'sock-amelia',
        });

        expect(result.current.typingUsers).toEqual({});
    });

    it('clears typing indicator and updates query cache when a message arrives', () => {
        const onNewMessage = vi.fn();
        const wrapper = createWrapper();

        queryClient.setQueryData(['ticket', 'ticket-1'], {
            id: 'ticket-1',
            title: 'internet mati',
            messages: [],
        });

        const { result } = renderHook(
            () => useTicketSocket({ ticketId: 'ticket-1', onNewMessage }),
            { wrapper }
        );

        // Simulate typing
        fire('typing:start', {
            ticketId: 'ticket-1',
            user: { fullName: 'Amelia Yolanda' },
            socketId: 'sock-amelia',
        });
        expect(result.current.typingUsers).toEqual({
            'sock-amelia': 'Amelia Yolanda',
        });

        // Now message arrives
        const incomingMessage = {
            id: 'msg-1',
            content: 'Sudah bisa pak terima kasih',
            sender: { id: 'user-amelia', fullName: 'Amelia Yolanda', role: 'USER' },
            createdAt: new Date().toISOString(),
        };

        fire('ticket:newMessage', {
            ticketId: 'ticket-1',
            message: incomingMessage,
        });

        // Typing indicator should be cleared immediately
        expect(result.current.typingUsers).toEqual({});

        // Query cache should be updated with new message
        const updatedTicket: any = queryClient.getQueryData(['ticket', 'ticket-1']);
        expect(updatedTicket.messages).toHaveLength(1);
        expect(updatedTicket.messages[0].content).toBe('Sudah bisa pak terima kasih');
        expect(onNewMessage).toHaveBeenCalledWith(incomingMessage);
    });

    it('clears typing indicator and invalidates ticket query when an in-app reply notification arrives', () => {
        const wrapper = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), {
            wrapper,
        });

        // Simulate typing
        fire('typing:start', {
            ticketId: 'ticket-1',
            user: { fullName: 'Amelia Yolanda' },
            socketId: 'sock-amelia',
        });
        expect(result.current.typingUsers).toEqual({
            'sock-amelia': 'Amelia Yolanda',
        });

        // Notification arrives on user-specific channel
        fire('notification:agent-123', {
            type: 'TICKET_REPLY',
            ticketId: 'ticket-1',
            message: 'Amelia Yolanda membalas tiket',
        });

        // Typing indicator cleared
        expect(result.current.typingUsers).toEqual({});

        // Active ticket query invalidated for fail-safe background sync (debounced)
        act(() => {
            vi.advanceTimersByTime(TICKET_RESYNC_DEBOUNCE_MS);
        });
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: ['ticket', 'ticket-1'] })
        );
    });

    it('refetches the ticket at most once when a reply arrives as both a message and a notification', () => {
        const wrapper = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper });

        fire('ticket:newMessage', { ticketId: 'ticket-1', message: { id: 'm-9', content: 'hi' } });
        fire('notification:agent-123', { type: 'TICKET_REPLY', ticketId: 'ticket-1' });
        act(() => {
            vi.advanceTimersByTime(TICKET_RESYNC_DEBOUNCE_MS);
        });

        const ticketRefetches = invalidateSpy.mock.calls.filter(([arg]: any) => arg?.queryKey?.[0] === 'ticket');
        expect(ticketRefetches.length).toBeLessThanOrEqual(1);
    });

    it('does not reload the whole ticket and its history for a chat message the socket already delivered', () => {
        const wrapper = createWrapper();
        queryClient.setQueryData(['ticket', 'ticket-1'], { id: 'ticket-1', messages: [] });
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper });

        fire('ticket:newMessage', { ticketId: 'ticket-1', message: { id: 'm-9', content: 'hi', isSystemMessage: false } });
        act(() => {
            vi.advanceTimersByTime(TICKET_RESYNC_DEBOUNCE_MS * 4);
        });

        // Appended from the socket payload: every viewer used to refetch the full history per message.
        expect((queryClient.getQueryData(['ticket', 'ticket-1']) as any).messages).toEqual([expect.objectContaining({ id: 'm-9' })]);
        expect(invalidateSpy.mock.calls.filter(([arg]: any) => arg?.queryKey?.[0] === 'ticket' || arg?.queryKey?.[0] === 'ticket-messages')).toHaveLength(0);
    });

    it('marks a message read when it arrives while the ticket is open, so no unread dot is left behind', async () => {
        const wrapper = createWrapper();
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper });

        fire('ticket:newMessage', { ticketId: 'ticket-1', message: { id: 'm-1', content: 'a', isSystemMessage: false } });
        fire('ticket:newMessage', { ticketId: 'ticket-1', message: { id: 'm-2', content: 'b', isSystemMessage: false } });
        act(() => {
            vi.advanceTimersByTime(TICKET_RESYNC_DEBOUNCE_MS);
        });

        // One lightweight read call for the burst, not a reload of the ticket.
        expect(apiPost).toHaveBeenCalledTimes(1);
        expect(apiPost).toHaveBeenCalledWith('/tickets/ticket-1/read', undefined, expect.objectContaining({ skipToast: true }));
    });

    it('reloads the ticket once after a status change, so the response badge and SLA card follow', () => {
        const wrapper = createWrapper();
        queryClient.setQueryData(['ticket', 'ticket-1'], { id: 'ticket-1', status: 'TODO', messages: [] });
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper });

        fire('ticket:statusChanged', { ticketId: 'ticket-1', status: 'IN_PROGRESS' });
        // Status shows at once from the event...
        expect((queryClient.getQueryData(['ticket', 'ticket-1']) as any).status).toBe('IN_PROGRESS');
        act(() => {
            vi.advanceTimersByTime(TICKET_RESYNC_DEBOUNCE_MS);
        });
        // ...and one reload brings the first response and SLA start that came with it.
        expect(invalidateSpy.mock.calls.filter(([arg]: any) => arg?.queryKey?.[0] === 'ticket')).toHaveLength(1);
    });

    it('still resyncs the ticket for a system message, which can carry status or SLA changes', () => {
        const wrapper = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper });

        fire('ticket:newMessage', { ticketId: 'ticket-1', message: { id: 's-1', content: 'Status changed', isSystemMessage: true } });
        act(() => {
            vi.advanceTimersByTime(TICKET_RESYNC_DEBOUNCE_MS);
        });

        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['ticket', 'ticket-1'] }));
    });
    it('keeps the room joined when the caller passes a new inline callback each render', () => {
        const { rerender } = renderHook(() => useTicketSocket({ ticketId: 'ticket-1', onNewMessage: () => {} }), {
            wrapper: createWrapper(),
        });
        (socket.emit as any).mockClear();

        rerender();

        expect(socket.emit).not.toHaveBeenCalledWith('leave:ticket', 'ticket-1');
        expect(socket.emit).not.toHaveBeenCalledWith('join:ticket', 'ticket-1');
    });

    it('never leaves a typing name without its expiry timer after a re-render', () => {
        const { result, rerender } = renderHook(() => useTicketSocket({ ticketId: 'ticket-1', onNewMessage: () => {} }), {
            wrapper: createWrapper(),
        });

        fire('typing:start', { ticketId: 'ticket-1', user: { fullName: 'Amelia' }, socketId: 'sock-amelia' });
        rerender();
        act(() => {
            vi.advanceTimersByTime(3600);
        });

        expect(result.current.typingUsers).toEqual({});
    });

    it('merges the read marker into the ticket cache', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        queryClient.setQueryData(['ticket', 'ticket-1'], { id: 'ticket-1', userLastReadAt: null, agentLastReadAt: '2026-10-31T07:00:00Z' });

        fire('ticket:readStateChanged', { ticketId: 'ticket-1', userLastReadAt: '2026-10-31T08:00:00Z' });

        expect(queryClient.getQueryData(['ticket', 'ticket-1'])).toEqual({
            id: 'ticket-1', userLastReadAt: '2026-10-31T08:00:00Z', agentLastReadAt: '2026-10-31T07:00:00Z',
        });
    });

    it('ignores read state for another ticket', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        const cached = { id: 'ticket-1', userLastReadAt: null, agentLastReadAt: null };
        queryClient.setQueryData(['ticket', 'ticket-1'], cached);

        fire('ticket:readStateChanged', { ticketId: 'ticket-2', userLastReadAt: '2026-10-31T08:00:00Z' });

        expect(queryClient.getQueryData(['ticket', 'ticket-1'])).toBe(cached);
    });

    it('replaces an updated message in both caches', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        queryClient.setQueryData(['ticket', 'ticket-1'], { id: 'ticket-1', messages: [{ id: 'm-1', content: 'lama' }, { id: 'm-2', content: 'lain' }] });
        queryClient.setQueryData(['ticket-messages', 'ticket-1'], [{ id: 'm-1', content: 'lama' }]);

        fire('ticket:messageUpdated', { ticketId: 'ticket-1', message: { id: 'm-1', content: '', isDeleted: true } });

        expect((queryClient.getQueryData(['ticket', 'ticket-1']) as any).messages).toEqual([
            { id: 'm-1', content: '', isDeleted: true }, { id: 'm-2', content: 'lain' },
        ]);
        expect(queryClient.getQueryData(['ticket-messages', 'ticket-1'])).toEqual([{ id: 'm-1', content: '', isDeleted: true }]);
    });

    it('ignores message updates for another ticket', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        const cached = { id: 'ticket-1', messages: [{ id: 'm-1', content: 'lama' }] };
        queryClient.setQueryData(['ticket', 'ticket-1'], cached);

        fire('ticket:messageUpdated', { ticketId: 'ticket-2', message: { id: 'm-1', content: 'x' } });

        expect(queryClient.getQueryData(['ticket', 'ticket-1'])).toBe(cached);
    });

    it('applies reaction changes to the open ticket, and ignores another ticket', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        queryClient.setQueryData(['ticket', 'ticket-1'], { id: 'ticket-1', messages: [{ id: 'm-1', reactions: [] }] });
        const reactions = [{ emoji: 'x', count: 1, userIds: ['u'], userNames: ['U'] }];

        fire('ticket:reactionsChanged', { ticketId: 'ticket-2', messageId: 'm-1', reactions });
        expect((queryClient.getQueryData(['ticket', 'ticket-1']) as any).messages[0].reactions).toEqual([]);

        fire('ticket:reactionsChanged', { ticketId: 'ticket-1', messageId: 'm-1', reactions });
        expect((queryClient.getQueryData(['ticket', 'ticket-1']) as any).messages[0].reactions).toEqual(reactions);
    });

    it('applies pin changes to the open ticket', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        queryClient.setQueryData(['ticket', 'ticket-1'], { id: 'ticket-1', messages: [{ id: 'm-1' }, { id: 'm-2', isPinned: true }] });

        fire('ticket:pinsChanged', { ticketId: 'ticket-1', pins: [{ id: 'm-1', senderName: 'A', snippet: 'x', pinnedAt: '2026-11-02T08:00:00Z', isInternal: false }] });

        const messages = (queryClient.getQueryData(['ticket', 'ticket-1']) as any).messages;
        expect(messages.map((m: any) => Boolean(m.isPinned))).toEqual([true, false]);
    });

    it('ignores pins of another ticket', () => {
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper: createWrapper() });
        const cached = { id: 'ticket-1', messages: [{ id: 'm-1', isPinned: true }] };
        queryClient.setQueryData(['ticket', 'ticket-1'], cached);

        fire('ticket:pinsChanged', { ticketId: 'ticket-2', pins: [] });

        expect(queryClient.getQueryData(['ticket', 'ticket-1'])).toBe(cached);
    });

    it('refetches the ticket after a reconnect so missed messages appear', () => {
        const wrapper = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        renderHook(() => useTicketSocket({ ticketId: 'ticket-1' }), { wrapper });

        fire('connect');

        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['ticket', 'ticket-1'] }));
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['ticket-messages', 'ticket-1'] }));
    });
});

describe('useTicketListSocket', () => {
    let queryClient: QueryClient;

    const createWrapper = () => {
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        return ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
    };

    beforeEach(() => {
        vi.useFakeTimers();
        handlers.clear();
        vi.clearAllMocks();
        socket.connected = true;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('a system line (e.g. "X menyematkan pesan") leaves the unread dot alone', () => {
        renderHook(() => useTicketListSocket(), { wrapper: createWrapper() });
        const list = [{ id: 't-1', hasUnreadChat: false, unreadMessageCount: 0 }];
        queryClient.setQueryData(['tickets'], list);

        fire('ticket:newMessage', { ticketId: 't-1', message: { id: 's-1', isSystemMessage: true } });

        expect(queryClient.getQueryData(['tickets'])).toBe(list);
    });

    it('collapses a burst of ticket events into one invalidation per query key', () => {
        const wrapper = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        renderHook(() => useTicketListSocket(), { wrapper });

        fire('ticket:updated', { ticketId: 't-1' });
        fire('tickets:statusChanged', { ticketId: 't-1' });
        fire('tickets:listUpdated');
        fire('dashboard:stats:update');
        expect(invalidateSpy).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(LIST_INVALIDATE_DEBOUNCE_MS);
        });

        expect(invalidateSpy).toHaveBeenCalledTimes(2);
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tickets'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard-stats'] });
    });

    it('waits long enough to fold a burst of ticket changes from many users into one refetch', () => {
        expect(LIST_INVALIDATE_DEBOUNCE_MS).toBeGreaterThanOrEqual(2000);
    });

    it('drops pending invalidations on unmount', () => {
        const wrapper = createWrapper();
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { unmount } = renderHook(() => useTicketListSocket(), { wrapper });

        fire('tickets:listUpdated');
        unmount();
        act(() => {
            vi.advanceTimersByTime(LIST_INVALIDATE_DEBOUNCE_MS);
        });

        expect(invalidateSpy).not.toHaveBeenCalled();
    });
});
