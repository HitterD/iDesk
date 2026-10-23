// iDesk service worker: shows Web Push notifications as OS toasts and routes their clicks.
// Works on its own; the SJA desktop notifier is an optional extra, never a requirement.

const ICON = '/idesk-icon.png';
const SLA_TYPES = ['SLA_WARNING', 'SLA_BREACHED'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    event.waitUntil(showPush(event.data));
});

async function showPush(data) {
    let payload = {};
    try {
        payload = data ? data.json() : {};
    } catch (error) {
        payload = { body: data ? data.text() : '' };
    }

    // A tab the user is looking at already shows this as an in-app toast; a second OS toast is noise.
    // (Allowed with userVisibleOnly: the browser only insists on a notification when no page is visible.)
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((client) => client.visibilityState === 'visible' && client.focused)) return;

    const tag = payload.tag || payload.notificationId || undefined;
    return self.registration.showNotification(payload.title || 'iDesk', {
        body: payload.body || '',
        icon: payload.icon || ICON,
        badge: payload.badge || ICON,
        tag,
        // Same tag replaces the toast on screen (one per ticket chat); still alert for the new one.
        renotify: Boolean(tag),
        timestamp: payload.timestamp ? Date.parse(payload.timestamp) : Date.now(),
        requireInteraction: SLA_TYPES.includes(payload.type),
        data: { url: payload.url || payload.link || '/', notificationId: payload.notificationId || null },
    });
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const { url, notificationId } = event.notification.data || {};
    const target = new URL(url || '/', self.location.origin);
    if (target.origin !== self.location.origin) return;
    // The app marks this notification read when it sees ?nid= (useNotificationClickRead).
    if (notificationId) target.searchParams.set('nid', notificationId);
    event.waitUntil(openInApp(target));
});

async function openInApp(target) {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (!tab) return self.clients.openWindow(target.href);
    await tab.focus();
    // Route inside the running app (no reload); the app listens for this message.
    tab.postMessage({ type: 'notification-click', url: target.pathname + target.search + target.hash });
}

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
