import api from './api';
import { logger } from './logger';

const SERVICE_WORKER_URL = '/sw.js';

/**
 * Where this browser stands on OS notifications:
 * - `unsupported`: no Notification/Push API (e.g. iPhone Safari outside an installed web app)
 * - `insecure`: opened over plain http, where browsers disable notifications
 * - otherwise the current permission
 */
export type NotificationSupport = 'unsupported' | 'insecure' | NotificationPermission;

export function getNotificationSupport(): NotificationSupport {
    if (typeof window === 'undefined') return 'unsupported';
    if (!window.isSecureContext) return 'insecure';
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    return Notification.permission;
}

/** Calls `onChange` when the user flips the permission in site settings, where the browser reports it. */
export function watchNotificationPermission(onChange: () => void): () => void {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    navigator.permissions?.query({ name: 'notifications' })
        .then((result) => {
            if (cancelled) return;
            status = result;
            status.onchange = onChange;
        })
        .catch(() => undefined);
    return () => {
        cancelled = true;
        if (status) status.onchange = null;
    };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(window.atob(padded), (char) => char.charCodeAt(0));
}

/**
 * Registers the service worker and makes sure this browser has a push subscription
 * stored for the signed-in user. Safe to call on every page load. Returns false
 * when push is unavailable here or not configured on the server.
 */
export async function ensurePushSubscription(): Promise<boolean> {
    if (getNotificationSupport() !== 'granted') return false;
    try {
        const { data } = await api.get<{ isConfigured: boolean; publicKey: string | null }>('/notifications/push/status');
        if (!data.isConfigured || !data.publicKey) return false;

        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription()
            ?? await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer,
            });
        // Always re-posted: the backend moves the endpoint to whoever is signed in now.
        const { endpoint, keys } = subscription.toJSON();
        await api.post('/notifications/push/subscribe', { subscription: { endpoint, keys } });
        return true;
    } catch (error) {
        logger.error('Push subscription failed:', error);
        return false;
    }
}

/**
 * Detaches this browser from the account being signed out, so the next person on
 * the same PC does not receive their toasts. Must run while the session is valid.
 */
export async function releasePushSubscription(): Promise<void> {
    if (getNotificationSupport() !== 'granted') return;
    try {
        const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        await api.post('/notifications/push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
    } catch (error) {
        logger.error('Push unsubscribe failed:', error);
    }
}
