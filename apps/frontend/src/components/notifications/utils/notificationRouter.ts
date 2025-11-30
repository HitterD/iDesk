import { NotificationCategory, Notification } from '../types/notification.types';

export type UserRole = 'ADMIN' | 'AGENT' | 'USER';

/**
 * Route configuration for deep linking based on notification category and user role
 */
interface NotificationRoute {
    category: NotificationCategory;
    getPath: (id: string | undefined, role: UserRole) => string;
}

export const NOTIFICATION_ROUTES: Record<NotificationCategory, NotificationRoute> = {
    [NotificationCategory.CATEGORY_TICKET]: {
        category: NotificationCategory.CATEGORY_TICKET,
        getPath: (ticketId, role) => {
            const basePath = role === 'USER' ? '/client/tickets' : '/tickets';
            const fallback = role === 'USER' ? '/client/my-tickets' : '/tickets/list';
            return ticketId ? `${basePath}/${ticketId}` : fallback;
        },
    },
    [NotificationCategory.CATEGORY_RENEWAL]: {
        category: NotificationCategory.CATEGORY_RENEWAL,
        getPath: (referenceId, role) => {
            // Only Admin can access renewal
            if (role === 'USER') return '/client/my-tickets';
            if (role === 'AGENT') return '/dashboard';
            return '/renewal';
        },
    },
};

/**
 * Get the redirect path for a notification based on its category and user role
 * @param notification - The notification to get redirect path for
 * @param userRole - The current user's role
 * @returns The path to navigate to
 */
export function getNotificationRedirectPath(
    notification: Notification,
    userRole: UserRole = 'USER'
): string {
    const { category, ticketId, referenceId, link } = notification;

    switch (category) {
        case NotificationCategory.CATEGORY_TICKET: {
            const basePath = userRole === 'USER' ? '/client/tickets' : '/tickets';
            const fallback = userRole === 'USER' ? '/client/my-tickets' : '/tickets/list';
            return ticketId ? `${basePath}/${ticketId}` : fallback;
        }

        case NotificationCategory.CATEGORY_RENEWAL: {
            // Only Admin can access renewal page
            if (userRole === 'USER') return '/client/my-tickets';
            if (userRole === 'AGENT') return '/dashboard';
            return '/renewal';
        }

        default:
            // Use provided link or role-appropriate dashboard
            if (link) return link;
            return userRole === 'USER' ? '/client/my-tickets' : '/dashboard';
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

/**
 * Check if a notification category is accessible by a given role
 */
export function canAccessNotification(category: NotificationCategory, role: UserRole): boolean {
    switch (category) {
        case NotificationCategory.CATEGORY_RENEWAL:
            return role === 'ADMIN';
        case NotificationCategory.CATEGORY_TICKET:
            return true; // All roles can access ticket notifications
        default:
            return true;
    }
}

/**
 * Get appropriate notification center path based on role
 */
export function getNotificationCenterPath(role: UserRole): string {
    return role === 'USER' ? '/client/notifications' : '/notifications';
}
