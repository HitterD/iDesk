/** Shared "Buat Tiket Baru" entry action for the agent and requester shells (topbar CTA + mobile bottom nav). */

export const CREATE_TICKET_LABEL = 'Buat Tiket Baru';
export const CREATE_TICKET_SHORT_LABEL = 'Tiket Baru';

/** Existing route: routes/AppRoutes.tsx `tickets/create` (reads `?type=` via BentoCreateTicketPage). */
const CREATE_TICKET_PATH = '/tickets/create';
/** Existing route: routes/AppRoutes.tsx `/client` > `create`; the only create route a USER may open. */
export const CLIENT_CREATE_TICKET_PATH = '/client/create';

/** Roles whose create action pre-selects a ticket type. Mirrors the previous MobileBottomNav behaviour. */
const ROLE_CREATE_TYPE: Readonly<Record<string, string>> = {
    AGENT_ORACLE: 'oracle-request',
};

export const getCreateTicketPath = (role?: string | null): string => {
    const type = role && Object.prototype.hasOwnProperty.call(ROLE_CREATE_TYPE, role) ? ROLE_CREATE_TYPE[role] : undefined;
    return type ? `${CREATE_TICKET_PATH}?type=${type}` : CREATE_TICKET_PATH;
};
