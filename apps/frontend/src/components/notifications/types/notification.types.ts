export enum NotificationCategory {
    CATEGORY_TICKET = 'CATEGORY_TICKET',
    CATEGORY_RENEWAL = 'CATEGORY_RENEWAL',
    CATEGORY_HARDWARE = 'CATEGORY_HARDWARE',
    CATEGORY_ZOOM = 'CATEGORY_ZOOM',
    CATEGORY_EFORM = 'CATEGORY_EFORM',
}

export enum NotificationType {
    // Ticket-related
    TICKET_CREATED = 'TICKET_CREATED',
    TICKET_ASSIGNED = 'TICKET_ASSIGNED',
    TICKET_UPDATED = 'TICKET_UPDATED',
    TICKET_RESOLVED = 'TICKET_RESOLVED',
    TICKET_CANCELLED = 'TICKET_CANCELLED',
    TICKET_REPLY = 'TICKET_REPLY',
    CHAT_MESSAGE_RECEIVED = 'CHAT_MESSAGE_RECEIVED',
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

    // Hardware & ICT Budget notifications
    ICT_BUDGET_CREATED = 'ICT_BUDGET_CREATED',
    ICT_BUDGET_APPROVED = 'ICT_BUDGET_APPROVED',
    ICT_BUDGET_REJECTED = 'ICT_BUDGET_REJECTED',
    ICT_BUDGET_ARRIVED = 'ICT_BUDGET_ARRIVED',
    HARDWARE_INSTALL_REQUESTED = 'HARDWARE_INSTALL_REQUESTED',
    HARDWARE_INSTALL_APPROVED = 'HARDWARE_INSTALL_APPROVED',
    HARDWARE_INSTALL_RESCHEDULED = 'HARDWARE_INSTALL_RESCHEDULED',
    HARDWARE_INSTALL_COMPLETED = 'HARDWARE_INSTALL_COMPLETED',
    HARDWARE_INSTALL_D1 = 'HARDWARE_INSTALL_D1',
    HARDWARE_INSTALL_D0 = 'HARDWARE_INSTALL_D0',

    // Zoom booking notifications
    ZOOM_BOOKING_CONFIRMED = 'ZOOM_BOOKING_CONFIRMED',
    ZOOM_BOOKING_CANCELLED = 'ZOOM_BOOKING_CANCELLED',
    ZOOM_BOOKING_REMINDER = 'ZOOM_BOOKING_REMINDER',

    // VPN access expiry notifications
    VPN_EXPIRY_D60 = 'VPN_EXPIRY_D60',
    VPN_EXPIRY_D30 = 'VPN_EXPIRY_D30',
    VPN_EXPIRY_D7 = 'VPN_EXPIRY_D7',
    VPN_EXPIRY_D1 = 'VPN_EXPIRY_D1',

    // E-Form Access notifications
    EFORM_SUBMITTED = 'EFORM_SUBMITTED',
    EFORM_MANAGER1_APPROVED = 'EFORM_MANAGER1_APPROVED',
    EFORM_MANAGER2_APPROVED = 'EFORM_MANAGER2_APPROVED',
    EFORM_ICT_CONFIRMED = 'EFORM_ICT_CONFIRMED',
    EFORM_REJECTED = 'EFORM_REJECTED',
    EFORM_CREDENTIALS_READY = 'EFORM_CREDENTIALS_READY',
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
    requiresAcknowledge?: boolean;
    acknowledgedAt?: string;
    createdAt: string;
}

export interface NotificationCountByCategory {
    [NotificationCategory.CATEGORY_TICKET]: number;
    [NotificationCategory.CATEGORY_RENEWAL]: number;
    [NotificationCategory.CATEGORY_HARDWARE]: number;
    [NotificationCategory.CATEGORY_ZOOM]: number;
    [NotificationCategory.CATEGORY_EFORM]: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
