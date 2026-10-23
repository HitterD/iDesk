import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { useNotificationClickRead } from '../useNotificationClickRead';

vi.mock('@/lib/api', () => ({ default: { patch: vi.fn() } }));
const auth = vi.hoisted(() => ({ role: 'AGENT' }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1', role: auth.role } }) }));

const NID = '0f8f5a3c-1d2b-4c3d-9e8f-123456789abc';
const listeners = new Set<(event: MessageEvent) => void>();

beforeEach(() => {
    auth.role = 'AGENT';
    vi.mocked(api.patch).mockReset().mockResolvedValue({ data: {} });
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            addEventListener: (_: string, fn: (event: MessageEvent) => void) => listeners.add(fn),
            removeEventListener: (_: string, fn: (event: MessageEvent) => void) => listeners.delete(fn),
        },
    });
});
afterEach(() => listeners.clear());

const renderAt = (url: string) => renderHook(() => {
    useNotificationClickRead();
    return useLocation();
}, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={new QueryClient()}>
            <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
        </QueryClientProvider>
    ),
});

describe('useNotificationClickRead', () => {
    it('marks the clicked notification read and drops ?nid from the address', async () => {
        const { result } = renderAt(`/tickets/t-1?tab=chat&nid=${NID}`);

        await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/notifications/${NID}/read`, undefined, { skipToast: true }));
        expect(result.current.pathname).toBe('/tickets/t-1');
        expect(result.current.search).toBe('?tab=chat');
    });

    it('sends a requester to their own ticket page', async () => {
        auth.role = 'USER';
        const { result } = renderAt(`/tickets/t-1?nid=${NID}`);

        await waitFor(() => expect(result.current.pathname).toBe('/client/tickets/t-1'));
        expect(result.current.search).toBe('');
    });

    it('routes the running app when the service worker reports a click', () => {
        const { result } = renderAt('/dashboard');

        act(() => listeners.forEach((fn) => fn({ data: { type: 'notification-click', url: `/tickets/t-2?nid=${NID}` } } as MessageEvent)));

        expect(result.current.pathname).toBe('/tickets/t-2');
    });

    it('ignores messages that would leave the app', () => {
        const { result } = renderAt('/dashboard');

        act(() => listeners.forEach((fn) => fn({ data: { type: 'notification-click', url: '//evil.example/x' } } as MessageEvent)));

        expect(result.current.pathname).toBe('/dashboard');
    });
});
