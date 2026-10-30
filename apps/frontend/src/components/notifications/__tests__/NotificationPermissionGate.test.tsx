import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPermissionGate } from '../NotificationPermissionGate';
import { useAuth } from '@/stores/useAuth';
import { ensurePushSubscription, getNotificationSupport } from '@/lib/webPush';

vi.mock('@/stores/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/webPush', () => ({
    getNotificationSupport: vi.fn(),
    ensurePushSubscription: vi.fn().mockResolvedValue(true),
    watchNotificationPermission: vi.fn(() => () => undefined),
}));

const support = getNotificationSupport as unknown as ReturnType<typeof vi.fn>;
const signedIn = (isAuthenticated: boolean) =>
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ isAuthenticated, user: isAuthenticated ? { id: 'u-1' } : null });

const renderGate = (disabled = false) =>
    render(<NotificationPermissionGate disabled={disabled}><p>Isi iDesk</p></NotificationPermissionGate>);

describe('NotificationPermissionGate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        signedIn(true);
    });

    it('blocks a signed-in user until notifications are allowed', async () => {
        support.mockReturnValue('default');
        const requestPermission = vi.fn(async () => {
            support.mockReturnValue('granted');
            return 'granted';
        });
        vi.stubGlobal('Notification', { requestPermission });

        renderGate();
        expect(screen.queryByText('Isi iDesk')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Aktifkan notifikasi/ }));

        await waitFor(() => expect(screen.getByText('Isi iDesk')).toBeInTheDocument());
        expect(requestPermission).toHaveBeenCalled();
        expect(ensurePushSubscription).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    it('explains how to unblock when the permission was denied', () => {
        support.mockReturnValue('denied');
        renderGate();

        expect(screen.getByText('Notifikasi iDesk diblokir')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cek lagi/ })).toBeInTheDocument();
        expect(screen.queryByText('Isi iDesk')).not.toBeInTheDocument();
    });

    it('only warns when the browser cannot show notifications', () => {
        support.mockReturnValue('unsupported');
        renderGate();

        expect(screen.getByText('Isi iDesk')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('tidak mendukung notifikasi');
    });

    it('never asks signed-out visitors or public screens', () => {
        support.mockReturnValue('default');
        signedIn(false);
        const { unmount } = renderGate();
        expect(screen.getByText('Isi iDesk')).toBeInTheDocument();
        unmount();

        signedIn(true);
        renderGate(true);
        expect(screen.getByText('Isi iDesk')).toBeInTheDocument();
        expect(ensurePushSubscription).not.toHaveBeenCalled();
    });

    it('subscribes this browser when permission is already granted', () => {
        support.mockReturnValue('granted');
        renderGate();

        expect(screen.getByText('Isi iDesk')).toBeInTheDocument();
        expect(ensurePushSubscription).toHaveBeenCalledTimes(1);
    });
});
