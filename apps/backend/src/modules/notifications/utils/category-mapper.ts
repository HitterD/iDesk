import { NotificationType, NotificationCategory } from '../entities/notification.entity';

/**
 * Maps a NotificationType to its corresponding NotificationCategory
 * Used to automatically categorize notifications for filtering in the UI
 */
export function getCategoryFromType(type: NotificationType): NotificationCategory {
    const renewalTypes: NotificationType[] = [
        NotificationType.RENEWAL_D60_WARNING,
        NotificationType.RENEWAL_D30_WARNING,
        NotificationType.RENEWAL_D7_WARNING,
        NotificationType.RENEWAL_D1_WARNING,
        NotificationType.RENEWAL_EXPIRED,
    ];

    return renewalTypes.includes(type)
        ? NotificationCategory.CATEGORY_RENEWAL
        : NotificationCategory.CATEGORY_TICKET;
}

/**
 * Check if a notification type is renewal-related
 */
export function isRenewalNotification(type: NotificationType): boolean {
    return getCategoryFromType(type) === NotificationCategory.CATEGORY_RENEWAL;
}

/**
 * Check if a notification type is ticket-related
 */
export function isTicketNotification(type: NotificationType): boolean {
    return getCategoryFromType(type) === NotificationCategory.CATEGORY_TICKET;
}
