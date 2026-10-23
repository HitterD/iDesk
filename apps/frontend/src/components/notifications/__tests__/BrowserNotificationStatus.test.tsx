import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/api';
import { BrowserNotificationStatus } from '../BrowserNotificationStatus';

const push = vi.hoisted(() => ({ support: 'granted' as string, ensure: vi.fn(), local: true }));
vi.mock('@/lib/webPush', () => ({
    getNotificationSupport: () => push.support,
    ensurePushSubscription: push.ensure,
    hasLocalPushSubscription: async () => push.local,
}));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const renderStatus = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BrowserNotificationStatus />
    </QueryClientProvider>,
);

beforeEach(() => {
    vi.clearAllMocks();
    push.support = 'granted';
    push.local = true;
    vi.mocked(api.get).mockResolvedValue({ data: { isConfigured: true, isSubscribed: true } });
});

describe('BrowserNotificationStatus', () => {
    it('explains that plain http blocks notifications', () => {
        push.support = 'insecure';
        renderStatus();
        expect(screen.getByText('Notifikasi browser butuh HTTPS')).toBeInTheDocument();
    });

    it('tells how to unblock a denied permission', () => {
        push.support = 'denied';
        renderStatus();
        expect(screen.getByText(/ikon gembok/)).toBeInTheDocument();
    });

    it('offers to allow notifications when the browser has not asked yet', () => {
        push.support = 'default';
        renderStatus();
        expect(screen.getByRole('button', { name: 'Izinkan notifikasi' })).toBeInTheDocument();
    });

    it('offers to reconnect when this browser has no subscription stored', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { isConfigured: true, isSubscribed: false } });
        push.ensure.mockResolvedValue(true);
        renderStatus();

        await userEvent.click(await screen.findByRole('button', { name: 'Sambungkan' }));

        expect(push.ensure).toHaveBeenCalled();
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it('asks to connect this browser even when another device of the account is subscribed', async () => {
        push.local = false;
        renderStatus();
        expect(await screen.findByRole('button', { name: 'Sambungkan' })).toBeInTheDocument();
    });

    it('sends a test toast when everything is active', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { delivered: true, error: null } });
        renderStatus();

        await userEvent.click(await screen.findByRole('button', { name: 'Kirim uji' }));

        expect(api.post).toHaveBeenCalledWith('/notifications/push/test');
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('terkirim'));
    });
});
