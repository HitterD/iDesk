import { NotificationCategory, Notification } from '../entities/notification.entity';

export interface NotificationRoute {
    category: NotificationCategory;
    baseUrl: string;
    paramKey: string;
}

/**
 * Route configuration for each notification category
 * Used for deep linking when user clicks on a notification
 */
export const NOTIFICATION_ROUTES: Record<NotificationCategory, NotificationRoute> = {
    [NotificationCategory.CATEGORY_TICKET]: {
        category: NotificationCategory.CATEGORY_TICKET,
        baseUrl: '/ticket/view',
        paramKey: 'ticketId',
    },
    [NotificationCategory.CATEGORY_RENEWAL]: {
        category: NotificationCategory.CATEGORY_RENEWAL,
        baseUrl: '/renewal/detail',
        paramKey: 'referenceId',
    },
};

/**
 * Generates a deep link URL based on notification category and reference
 * @param notification - The notification to generate a link for
 * @returns The deep link URL
 */
export function generateDeepLink(notification: Notification): string {
    const route = NOTIFICATION_ROUTES[notification.category];

    if (notification.category === NotificationCategory.CATEGORY_TICKET && notification.ticketId) {
        return `${route.baseUrl}/${notification.ticketId}`;
    }

    if (notification.category === NotificationCategory.CATEGORY_RENEWAL && notification.referenceId) {
        return `${route.baseUrl}/${notification.referenceId}`;
    }

    // Fallback to explicit link field or default
    return notification.link || '/notifications';
}

/**
 * Get the route configuration for a specific category
 */
export function getRouteForCategory(category: NotificationCategory): NotificationRoute {
    return NOTIFICATION_ROUTES[category];
}
