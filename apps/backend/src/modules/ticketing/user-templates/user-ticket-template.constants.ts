/** Create-ticket forms a personal template can belong to (frontend FormTicketType). */
export const USER_TEMPLATE_TICKET_TYPES = ['service', 'oracle-request', 'web-dev-request', 'mobile-dev-request'] as const;
export type UserTemplateTicketType = typeof USER_TEMPLATE_TICKET_TYPES[number];

/** Most templates one person may keep (all forms together). */
export const USER_TEMPLATE_MAX_PER_USER = 20;
export const USER_TEMPLATE_LABEL_MIN = 2;
export const USER_TEMPLATE_LABEL_MAX = 40;

/** Priorities a template may carry: the ones the create form offers. */
export const USER_TEMPLATE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
