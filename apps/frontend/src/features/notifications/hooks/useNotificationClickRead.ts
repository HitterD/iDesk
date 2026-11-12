import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { getNotificationRedirectPath, type UserRole } from '@/components/notifications/utils/notificationRouter';
import type { Notification } from '@/components/notifications/types/notification.types';

/** Query param the service worker appends to the URL of a clicked OS notification. */
export const NOTIFICATION_ID_PARAM = 'nid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Clicked OS (Web Push) notifications: the service worker either opens a tab or asks the running one to
 * route there (no reload), with `?nid=<notification id>`. That notification is marked read and the param
 * is dropped from the address bar. Mount once, inside the router.
 */
export function useNotificationClickRead(): void {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const role = useAuth().user?.role as UserRole | undefined;

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
        const onMessage = (event: MessageEvent) => {
            const { type, url } = (event.data ?? {}) as { type?: string; url?: unknown };
            if (type !== 'notification-click' || typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return;
            navigate(url);
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [navigate]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const notificationId = params.get(NOTIFICATION_ID_PARAM);
        if (!notificationId) return;
        params.delete(NOTIFICATION_ID_PARAM);
        const search = params.toString();
        // Push links are written in staff-portal form (/tickets/:id, /hardware-requests/:id); requesters and
        // managers have their own pages, and old links (/vpn-access) are mapped to today's page.
        const link = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
        const target = getNotificationRedirectPath({ link } as Notification, role ?? 'USER');
        navigate(target, { replace: true, state: location.state });
        if (!UUID.test(notificationId)) return;
        api.patch(`/notifications/${notificationId}/read`, undefined, { skipToast: true })
            .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
            .catch(() => {
                // Best effort: the target page's own read-by-target still clears it.
            });
    }, [location.search, location.pathname, location.hash, location.state, navigate, queryClient, role]);
}
