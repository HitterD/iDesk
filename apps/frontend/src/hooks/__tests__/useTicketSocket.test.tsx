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

const { useTicketSocket, useTicketListSocket, LIST_INVALIDATE_DEBOUNCE_MS } = await import('../useTicketSocket');

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

        // Active ticket query invalidated for fail-safe background sync
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: ['ticket', 'ticket-1'] })
        );
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
