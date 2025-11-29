import { NotificationCategory, Notification } from '../types/notification.types';

/**
 * Route configuration for deep linking based on notification category
 */
interface NotificationRoute {
    category: NotificationCategory;
    baseUrl: string;
}

export const NOTIFICATION_ROUTES: Record<NotificationCategory, NotificationRoute> = {
    [NotificationCategory.CATEGORY_TICKET]: {
        category: NotificationCategory.CATEGORY_TICKET,
        baseUrl: '/ticket/view',
    },
    [NotificationCategory.CATEGORY_RENEWAL]: {
        category: NotificationCategory.CATEGORY_RENEWAL,
        baseUrl: '/renewal/detail',
    },
};

/**
 * Get the redirect path for a notification based on its category
 * @param notification - The notification to get redirect path for
 * @returns The path to navigate to
 */
export function getNotificationRedirectPath(notification: Notification): string {
    const { category, ticketId, referenceId, link } = notification;

    switch (category) {
        case NotificationCategory.CATEGORY_TICKET:
            return ticketId ? `/ticket/view/${ticketId}` : '/tickets';

        case NotificationCategory.CATEGORY_RENEWAL:
            return referenceId ? `/renewal/detail/${referenceId}` : '/renewal';

        default:
            return link || '/dashboard';
    }
}

/**
 * Check if notification is ticket-related
 */
export function isTicketNotification(notification: Notification): boolean {
    return notification.category === NotificationCategory.CATEGORY_TICKET;
}

/**
 * Check if notification is renewal-related
 */
export function isRenewalNotification(notification: Notification): boolean {
    return notification.category === NotificationCategory.CATEGORY_RENEWAL;
}
