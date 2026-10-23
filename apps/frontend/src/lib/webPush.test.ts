import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './api';
import { ensurePushSubscription, getNotificationSupport, releasePushSubscription } from './webPush';

vi.mock('./api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const ENDPOINT = 'https://push.example/abc';
const SERVER_KEY = 'BEl6';
const keyBytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;

function installBrowser(permission: NotificationPermission, existing: boolean, subscribedWithKey = SERVER_KEY) {
    const subscription = {
        endpoint: ENDPOINT,
        options: { applicationServerKey: keyBytes(subscribedWithKey) },
        toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }),
        unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const pushManager = {
        getSubscription: vi.fn().mockResolvedValue(existing ? subscription : null),
        subscribe: vi.fn().mockResolvedValue(subscription),
    };
    const registration = { pushManager };
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('Notification', { permission });
    vi.stubGlobal('PushManager', function PushManager() { /* presence only */ });
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            register: vi.fn().mockResolvedValue(registration),
            getRegistration: vi.fn().mockResolvedValue(registration),
            ready: Promise.resolve(registration),
        },
    });
    return { subscription, pushManager };
}

describe('webPush', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (api.get as any).mockResolvedValue({ data: { isConfigured: true, publicKey: SERVER_KEY } });
        (api.post as any).mockResolvedValue({ data: {} });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('reports insecure pages, where browsers disable notifications', () => {
        vi.stubGlobal('isSecureContext', false);
        expect(getNotificationSupport()).toBe('insecure');
    });

    it('creates a subscription and stores it for the signed-in user', async () => {
        const { pushManager } = installBrowser('granted', false);

        await expect(ensurePushSubscription()).resolves.toBe(true);
        expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
        expect(api.post).toHaveBeenCalledWith('/notifications/push/subscribe', {
            subscription: { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } },
        });
    });

    it('re-posts an existing subscription so it follows the current account', async () => {
        const { pushManager } = installBrowser('granted', true);

        await ensurePushSubscription();
        expect(pushManager.subscribe).not.toHaveBeenCalled();
        expect(api.post).toHaveBeenCalledWith('/notifications/push/subscribe', expect.anything());
    });

    it('replaces a subscription made with an old server key', async () => {
        const { pushManager, subscription } = installBrowser('granted', true, 'AAAA');

        await expect(ensurePushSubscription()).resolves.toBe(true);
        expect(subscription.unsubscribe).toHaveBeenCalled();
        expect(pushManager.subscribe).toHaveBeenCalled();
    });

    it('does nothing without permission or server keys', async () => {
        installBrowser('default', false);
        await expect(ensurePushSubscription()).resolves.toBe(false);

        installBrowser('granted', false);
        (api.get as any).mockResolvedValue({ data: { isConfigured: false, publicKey: null } });
        await expect(ensurePushSubscription()).resolves.toBe(false);
        expect(api.post).not.toHaveBeenCalled();
    });

    it('detaches this browser from the account on logout', async () => {
        const { subscription } = installBrowser('granted', true);

        await releasePushSubscription();
        expect(api.post).toHaveBeenCalledWith('/notifications/push/unsubscribe', { endpoint: ENDPOINT });
        expect(subscription.unsubscribe).toHaveBeenCalled();
    });
});
