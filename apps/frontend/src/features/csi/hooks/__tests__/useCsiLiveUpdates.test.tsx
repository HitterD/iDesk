import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CSI_LIVE_FALLBACK_POLL_MS,
    CSI_SERVER_DISCONNECT_RETRY_MS,
    CsiLiveProvider,
    resetCsiLiveSocketForTests,
    resolveCsiSocketOrigin,
    useCsiLiveStatus,
    useCsiPollingFallback,
} from '../useCsiLiveUpdates';

type Listener = (...args: unknown[]) => void;

const socketMock = vi.hoisted(() => {
    const listeners = new Map<string, Set<Listener>>();
    const instance = {
        connected: false,
        active: true,
        connect: vi.fn(),
        emit: vi.fn(),
        on: vi.fn((event: string, fn: Listener) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event)!.add(fn);
            return instance;
        }),
        off: vi.fn((event: string, fn: Listener) => {
            listeners.get(event)?.delete(fn);
            return instance;
        }),
        disconnect: vi.fn(),
    };
    return {
        listeners,
        instance,
        trigger(event: string, ...args: unknown[]) {
            for (const fn of listeners.get(event) ?? []) fn(...args);
        },
        reset() {
            listeners.clear();
            instance.connected = false;
            instance.active = true;
            vi.clearAllMocks();
        },
    };
});

vi.mock('socket.io-client', () => ({
    io: vi.fn(() => socketMock.instance),
}));

function Probe() {
    const live = useCsiLiveStatus();
    const poll = useCsiPollingFallback();
    return (
        <div>
            <span data-testid="live">{live ? 'LIVE' : 'OFFLINE'}</span>
            <span data-testid="poll">{String(poll)}</span>
        </div>
    );
}

beforeEach(() => {
    resetCsiLiveSocketForTests();
    socketMock.reset();
});

afterEach(() => {
    resetCsiLiveSocketForTests();
    cleanup();
});

describe('useCsiLiveUpdates', () => {
    it('subscribes to scope room, invalidates CSI queries on csi:updated, and toggles polling fallback', () => {
        const qc = new QueryClient();
        const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

        render(
            <QueryClientProvider client={qc}>
                <CsiLiveProvider scope="ict">
                    <Probe />
                </CsiLiveProvider>
            </QueryClientProvider>,
        );

        expect(screen.getByTestId('live')).toHaveTextContent('OFFLINE');
        expect(screen.getByTestId('poll')).toHaveTextContent(String(CSI_LIVE_FALLBACK_POLL_MS));

        act(() => {
            socketMock.instance.connected = true;
            socketMock.trigger('connect');
        });

        expect(screen.getByTestId('live')).toHaveTextContent('LIVE');
        expect(screen.getByTestId('poll')).toHaveTextContent('false');
        expect(socketMock.instance.emit).toHaveBeenCalledWith('csi:subscribe', { scope: 'ict' });

        act(() => {
            socketMock.trigger('csi:updated', { scope: 'ICT', periodId: 'p1' });
        });

        const invalidatedKeys = invalidateSpy.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
        expect(invalidatedKeys).toContain(JSON.stringify(['csi', 'ict', 'dashboard']));
        expect(invalidatedKeys).toContain(JSON.stringify(['csi', 'ict', 'report', 'p1']));
        expect(invalidatedKeys).toContain(JSON.stringify(['csi', 'ict', 'respondents', 'p1']));
        expect(invalidatedKeys).toContain(JSON.stringify(['csi', 'ict', 'period', 'p1']));

        invalidateSpy.mockClear();
        act(() => {
            socketMock.instance.connected = false;
            socketMock.trigger('disconnect');
        });
        expect(screen.getByTestId('live')).toHaveTextContent('OFFLINE');
        expect(screen.getByTestId('poll')).toHaveTextContent(String(CSI_LIVE_FALLBACK_POLL_MS));

        act(() => {
            socketMock.instance.connected = true;
            socketMock.trigger('connect');
        });
        expect(invalidateSpy).toHaveBeenCalled();
    });

    it('returns non-polling defaults safely outside QueryClientProvider', () => {
        render(
            <CsiLiveProvider scope="hc">
                <Probe />
            </CsiLiveProvider>,
        );
        expect(screen.getByTestId('live')).toHaveTextContent('OFFLINE');
        expect(screen.getByTestId('poll')).toHaveTextContent('false');
    });

    it('strips /api and /v1 suffixes when resolving the /csi socket origin', () => {
        expect(resolveCsiSocketOrigin('https://idesk.santos.co.id/api/v1')).toBe('https://idesk.santos.co.id');
        expect(resolveCsiSocketOrigin('https://idesk.santos.co.id/api/')).toBe('https://idesk.santos.co.id');
        expect(resolveCsiSocketOrigin('/api')).toBe('');
        expect(resolveCsiSocketOrigin('http://localhost:5050/')).toBe('http://localhost:5050');
    });

    it('reconnects after io server disconnect and invalidates stale scope queries on recovery', () => {
        vi.useFakeTimers();
        try {
            const qc = new QueryClient();
            const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

            render(
                <QueryClientProvider client={qc}>
                    <CsiLiveProvider scope="hc">
                        <Probe />
                    </CsiLiveProvider>
                </QueryClientProvider>,
            );

            act(() => {
                socketMock.instance.connected = true;
                socketMock.trigger('connect');
            });
            invalidateSpy.mockClear();

            act(() => {
                socketMock.instance.connected = false;
                socketMock.trigger('disconnect', 'io server disconnect');
            });
            expect(screen.getByTestId('live')).toHaveTextContent('OFFLINE');
            expect(socketMock.instance.connect).not.toHaveBeenCalled();

            act(() => {
                vi.advanceTimersByTime(CSI_SERVER_DISCONNECT_RETRY_MS);
            });
            expect(socketMock.instance.connect).toHaveBeenCalledTimes(1);

            act(() => {
                socketMock.instance.connected = true;
                socketMock.trigger('connect');
            });
            expect(screen.getByTestId('live')).toHaveTextContent('LIVE');
            expect(invalidateSpy.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey)))
                .toContain(JSON.stringify(['csi', 'hc', 'dashboard']));
        } finally {
            vi.useRealTimers();
        }
    });
});
