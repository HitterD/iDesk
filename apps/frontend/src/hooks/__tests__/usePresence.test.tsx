import { act, render, renderHook, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

const fire = (event: string, payload?: any) => {
    act(() => {
        (handlers.get(event) ?? []).forEach((handler) => handler(payload));
    });
};

// Imported after the mock so `lib/socket` builds on the fake io().
const { usePresence, useIsUserOnline, usePresenceStore } = await import('../usePresence');
const { PresenceDot, PresenceBadge } = await import('@/components/ui/PresenceDot');

describe('usePresence', () => {
    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
        socket.connected = true;
        usePresenceStore.setState({ onlineUserIds: [] });
    });

    it('identifies immediately when the socket is already connected', () => {
        renderHook(() => usePresence('user-1'));
        expect(socket.emit).toHaveBeenCalledWith('identify', 'user-1');
    });

    it('re-identifies on every reconnect so the roster is refetched', () => {
        renderHook(() => usePresence('user-1'));
        (socket.emit as any).mockClear();

        fire('connect');

        expect(socket.emit).toHaveBeenCalledWith('identify', 'user-1');
    });

    it('does nothing without an authenticated user id', () => {
        renderHook(() => usePresence(undefined));
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it('stores the roster and applies online/offline deltas', () => {
        const { result } = renderHook(() => useIsUserOnline('user-2'));
        renderHook(() => usePresence('user-1'));

        fire('users:online', ['user-1', 'user-2']);
        expect(result.current).toBe(true);

        fire('user:offline', { userId: 'user-2' });
        expect(result.current).toBe(false);

        fire('user:online', { userId: 'user-2' });
        expect(result.current).toBe(true);
    });

    it('ignores malformed presence payloads', () => {
        renderHook(() => usePresence('user-1'));

        fire('users:online', { not: 'an array' });
        fire('user:online', {});
        fire('user:offline', undefined);

        expect(usePresenceStore.getState().onlineUserIds).toEqual([]);
    });

    it('clears the roster on disconnect instead of showing everyone as online', () => {
        renderHook(() => usePresence('user-1'));
        fire('users:online', ['user-1', 'user-2']);

        fire('disconnect');

        expect(usePresenceStore.getState().onlineUserIds).toEqual([]);
    });

    it('detaches its own listeners on unmount', () => {
        const { unmount } = renderHook(() => usePresence('user-1'));
        unmount();

        expect(handlers.get('users:online') ?? []).toHaveLength(0);
        expect(handlers.get('user:online') ?? []).toHaveLength(0);
        expect(handlers.get('user:offline') ?? []).toHaveLength(0);
    });
});

describe('PresenceDot', () => {
    beforeEach(() => {
        usePresenceStore.setState({ onlineUserIds: ['user-1'] });
    });

    it('exposes the status to assistive tech', () => {
        render(<PresenceDot userId="user-1" />);
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Online');
    });

    it('renders offline for an unknown user', () => {
        render(<PresenceDot userId="user-9" />);
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Offline');
    });

    it('renders offline when no user id is supplied', () => {
        render(<PresenceDot />);
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Offline');
    });

    it('names the user in the announcement when a name is supplied', () => {
        render(<PresenceDot userId="user-1" userName="Budi" />);
        expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Budi is online');
    });

    it('hides a decorative dot from assistive tech', () => {
        render(<PresenceDot userId="user-1" decorative />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('labels the badge with readable text and announces it once', () => {
        render(<PresenceBadge userId="user-1" />);
        expect(screen.getByText('Online')).toBeInTheDocument();
        expect(screen.queryByRole('status')).toBeNull();
    });
});
