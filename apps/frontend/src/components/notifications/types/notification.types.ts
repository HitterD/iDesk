export enum NotificationCategory {
    CATEGORY_TICKET = 'CATEGORY_TICKET',
    CATEGORY_RENEWAL = 'CATEGORY_RENEWAL',
}

export enum NotificationType {
    // Ticket-related
    TICKET_CREATED = 'TICKET_CREATED',
    TICKET_ASSIGNED = 'TICKET_ASSIGNED',
    TICKET_UPDATED = 'TICKET_UPDATED',
    TICKET_RESOLVED = 'TICKET_RESOLVED',
    TICKET_CANCELLED = 'TICKET_CANCELLED',
    TICKET_REPLY = 'TICKET_REPLY',
    MENTION = 'MENTION',
    SLA_WARNING = 'SLA_WARNING',
    SLA_BREACHED = 'SLA_BREACHED',
    SYSTEM = 'SYSTEM',

    // Renewal-related
    RENEWAL_D60_WARNING = 'RENEWAL_D60_WARNING',
    RENEWAL_D30_WARNING = 'RENEWAL_D30_WARNING',
    RENEWAL_D7_WARNING = 'RENEWAL_D7_WARNING',
    RENEWAL_D1_WARNING = 'RENEWAL_D1_WARNING',
    RENEWAL_EXPIRED = 'RENEWAL_EXPIRED',
}

export interface Notification {
    id: string;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    ticketId?: string;
    referenceId?: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export interface NotificationCountByCategory {
    [NotificationCategory.CATEGORY_TICKET]: number;
    [NotificationCategory.CATEGORY_RENEWAL]: number;
}
