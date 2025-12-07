// iDesk Service Worker for Push Notifications
// This file handles incoming push notifications and notification clicks

const CACHE_NAME = 'idesk-push-v1';

// Handle push events
self.addEventListener('push', function (event) {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'iDesk Notification',
        body: 'You have a new notification',
        icon: '/logo192.png',
        badge: '/badge.png',
        tag: 'default',
        url: '/',
    };

    try {
        if (event.data) {
            const payload = event.data.json();
            data = {
                title: payload.title || data.title,
                body: payload.body || data.body,
                icon: payload.icon || data.icon,
                badge: payload.badge || data.badge,
                tag: payload.tag || payload.notificationId || data.tag,
                url: payload.url || payload.link || data.url,
                type: payload.type,
                ticketId: payload.ticketId,
                timestamp: payload.timestamp,
            };
        }
    } catch (e) {
        console.error('[SW] Error parsing push data:', e);
    }

    // Build notification options
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: {
            url: data.url,
            type: data.type,
            ticketId: data.ticketId,
        },
        requireInteraction: data.type === 'SLA_WARNING' || data.type === 'SLA_BREACHED',
        vibrate: [200, 100, 200],
        actions: getNotificationActions(data.type, data.ticketId),
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';
    const action = event.action;

    let finalUrl = urlToOpen;

    // Handle action buttons
    if (action === 'view') {
        finalUrl = urlToOpen;
    } else if (action === 'dismiss') {
        return; // Just close the notification
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (windowClients) {
                // Check if the app is already open
                for (let client of windowClients) {
                    if (client.url.includes(self.registration.scope)) {
                        // Focus existing window and navigate
                        return client.focus().then(function (focusedClient) {
                            if ('navigate' in focusedClient) {
                                return focusedClient.navigate(finalUrl);
                            }
                        });
                    }
                }
                // Open new window if app not open
                return clients.openWindow(finalUrl);
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', function (event) {
    console.log('[SW] Notification closed:', event);
    // Could track analytics here
});

// Handle service worker installation
self.addEventListener('install', function (event) {
    console.log('[SW] Installing service worker...');
    self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', function (event) {
    console.log('[SW] Service worker activated');
    event.waitUntil(
        Promise.all([
            // Claim all clients
            self.clients.claim(),
            // Clean up old caches
            caches.keys().then(function (cacheNames) {
                return Promise.all(
                    cacheNames.filter(function (cacheName) {
                        return cacheName !== CACHE_NAME;
                    }).map(function (cacheName) {
                        return caches.delete(cacheName);
                    })
                );
            })
        ])
    );
});

// Helper function to get notification actions based on type
function getNotificationActions(type, ticketId) {
    const actions = [];

    if (ticketId) {
        actions.push({
            action: 'view',
            title: 'View Ticket',
            icon: '/icons/view.png',
        });
    }

    actions.push({
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/close.png',
    });

    return actions;
}

// Handle messages from the main app
self.addEventListener('message', function (event) {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
