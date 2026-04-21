import { NotificationCategory, Notification } from '../types/notification.types';

export type UserRole = 'ADMIN' | 'AGENT' | 'USER' | 'MANAGER';

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
    let { category, ticketId, referenceId, link } = notification;

    // Sanitize legacy `/admin/` links for non-MANAGER users
    if (link && link.startsWith('/admin/')) {
        link = link.replace('/admin/', '/');
    }

    // Determine path prefix based on role
    const prefix = userRole === 'USER' ? '/client' : userRole === 'MANAGER' ? '/manager' : '';

    // If link is explicitly provided, use it but check for role-specific replacements
    if (link) {
        if (userRole === 'USER' && link.startsWith('/tickets/')) {
            return `/client/tickets/${link.split('/tickets/')[1]}`;
        }
        if (userRole === 'MANAGER' && link.startsWith('/tickets/')) {
            return `/manager/tickets`; // Manager has single ticket page currently
        }
        return link;
    }

    switch (category) {
        case NotificationCategory.CATEGORY_TICKET: {
            const basePath = userRole === 'USER' ? '/client/tickets' : '/tickets';
            const fallback = userRole === 'USER' ? '/client/my-tickets' : '/tickets/list';
            if (userRole === 'MANAGER') return `/manager/tickets`;
            return ticketId ? `${basePath}/${ticketId}` : fallback;
        }

        case NotificationCategory.CATEGORY_RENEWAL: {
            if (userRole === 'USER') return '/client/my-tickets';
            return `${prefix}/renewal`;
        }

        case NotificationCategory.CATEGORY_HARDWARE: {
            const basePath = userRole === 'USER' ? '/client/hardware-requests' : '/hardware-requests';
            const fallback = userRole === 'USER' ? '/client/my-tickets' : '/hardware-requests';
            if (userRole === 'MANAGER') return `/manager/hardware-requests`;
            return referenceId ? `${basePath}/${referenceId}` : fallback;
        }

        case NotificationCategory.CATEGORY_ZOOM: {
            return `${prefix}/zoom-calendar`;
        }

        case NotificationCategory.CATEGORY_EFORM: {
            const basePath = userRole === 'USER' ? '/client/eform-access' : '/eform-access';
            return referenceId ? `${basePath}/${referenceId}` : basePath;
        }

        default:
            return userRole === 'USER' ? '/client/my-tickets' : '/dashboard';
    }
}

/**
 * Get appropriate notification center path based on role
 */
export function getNotificationCenterPath(role: UserRole): string {
    return role === 'USER' ? '/client/notifications' : '/notifications';
}
