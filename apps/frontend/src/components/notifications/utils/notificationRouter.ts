import { NotificationCategory, Notification } from '../types/notification.types';
import { getRoleHome, portalEquivalent } from '@/lib/roleHome';

export type UserRole = 'ADMIN' | 'AGENT' | 'USER' | 'MANAGER' | 'AGENT_OPERATIONAL_SUPPORT' | 'AGENT_ORACLE' | 'AGENT_WEB_DEV' | 'AGENT_MOBILE_DEV' | 'AGENT_ADMIN' | 'HC_ADMIN';

/**
 * Get the redirect path for a notification based on its category and user role
 * @param notification - The notification to get redirect path for
 * @param userRole - The current user's role
 * @returns The path to navigate to
 */
export function getNotificationRedirectPath(
    notification: Partial<Pick<Notification, 'category' | 'ticketId' | 'referenceId' | 'link'>>,
    userRole: UserRole = 'USER'
): string {
    const { category, ticketId, referenceId, link } = notification;

    // Explicit links are written in staff-portal form; move them to the reader's portal.
    // External links (e.g. a Zoom join URL) are not app routes: fall back to the category page.
    if (link && link.startsWith('/') && !link.startsWith('//')) {
        return portalEquivalent(link, userRole) ?? link;
    }

    const target = categoryPath(category, ticketId, referenceId);
    return (target && portalEquivalent(target, userRole)) ?? fallbackPath(userRole);
}

/** Staff-portal path of the item a notification is about, or null when it names no item page. */
function categoryPath(category: NotificationCategory | undefined, ticketId?: string, referenceId?: string): string | null {
    // `referenceId` may carry a `_step` suffix (hardware steps); only the id part names the page.
    const ref = referenceId?.split('_')[0];
    switch (category) {
        case NotificationCategory.CATEGORY_TICKET:
            return ticketId ? `/tickets/${ticketId}` : null;
        case NotificationCategory.CATEGORY_RENEWAL:
            return '/renewal?tab=contracts';
        case NotificationCategory.CATEGORY_HARDWARE:
            return ref ? `/hardware-requests/${ref}` : '/hardware-requests';
        case NotificationCategory.CATEGORY_ZOOM:
            return ref ? `/zoom-calendar?booking=${encodeURIComponent(ref)}` : '/zoom-calendar';
        case NotificationCategory.CATEGORY_EFORM:
            return ref ? `/eform-access/${ref}` : '/eform-access';
        default:
            return ticketId ? `/tickets/${ticketId}` : null;
    }
}

/** Where a notification without a reachable item page lands: the reader's ticket list. */
function fallbackPath(userRole: UserRole): string {
    if (userRole === 'USER') return '/client/my-tickets';
    if (userRole === 'MANAGER') return '/manager/tickets';
    if (userRole === 'HC_ADMIN') return getRoleHome(userRole);
    if (userRole === 'AGENT_ORACLE') return '/tickets/oracle-k2';
    if (userRole === 'AGENT_WEB_DEV') return '/tickets/web-developer';
    if (userRole === 'AGENT_MOBILE_DEV') return '/tickets/mobile-developer';
    return '/tickets/list';
}

/**
 * Get appropriate notification center path based on role
 */
export function getNotificationCenterPath(role: UserRole): string {
    return role === 'USER' ? '/client/notifications' : '/notifications';
}
