import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, Set<(payload: any) => void>>();
const mockSocket = {
    on: vi.fn((event: string, cb: (payload: any) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(cb);
    }),
    off: vi.fn((event: string, cb: (payload: any) => void) => {
        listeners.get(event)?.delete(cb);
    }),
};
const mockForwardToDesktopNotifier = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock('@/lib/socket', () => ({ useSocket: () => ({ socket: mockSocket }) }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1', role: 'AGENT' } }) }));
vi.mock('@/lib/desktopNotifier', () => ({
    forwardToDesktopNotifier: (...args: any[]) => mockForwardToDesktopNotifier(...args),
}));
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/api', () => ({ default: { post: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/hooks/useSoundNotification', () => ({
    useSoundNotification: () => ({ playSound: vi.fn() }),
}));
vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
            <div className={className}>{children}</div>
        ),
    },
}));

const { InAppNotificationToast } = await import('../InAppNotificationToast');

function emitSocket(event: string, payload: any) {
    act(() => {
        listeners.get(event)?.forEach((cb) => cb(payload));
    });
}

describe('InAppNotificationToast desktop forwarding suppression for open tickets', () => {
    beforeEach(() => {
        listeners.clear();
        vi.clearAllMocks();
    });

    it('keeps in-app toast visible but skips Desktop Notifier for TICKET_NOTE on the currently open ticket', () => {
        const ticketId = '11111111-1111-4111-8111-111111111111';
        window.history.pushState({}, '', `/tickets/${ticketId}`);
        render(<InAppNotificationToast />);

        emitSocket('notification:user-1', {
            id: 'notif-1',
            type: 'TICKET_NOTE',
            category: 'CATEGORY_TICKET',
            title: 'Catatan internal baru',
            message: 'Ada 1 pesan baru',
            link: `/tickets/${ticketId}?tab=notes`,
            isRead: false,
            createdAt: new Date().toISOString(),
        });

        expect(screen.getByText('Catatan internal baru')).toBeInTheDocument();
        expect(mockForwardToDesktopNotifier).not.toHaveBeenCalled();
    });

    it('still forwards TICKET_NOTE to Desktop Notifier when user is on another route', () => {
        const ticketId = '11111111-1111-4111-8111-111111111111';
        window.history.pushState({}, '', '/tickets/list');
        render(<InAppNotificationToast />);

        emitSocket('notification:user-1', {
            id: 'notif-2',
            type: 'TICKET_NOTE',
            category: 'CATEGORY_TICKET',
            title: 'Catatan internal baru',
            message: 'Ada 1 pesan baru',
            link: `/tickets/${ticketId}?tab=notes`,
            isRead: false,
            createdAt: new Date().toISOString(),
        });

        expect(screen.getByText('Catatan internal baru')).toBeInTheDocument();
        expect(mockForwardToDesktopNotifier).toHaveBeenCalledTimes(1);
    });
});
