/** What a connected app may do. Admins tick these per app; every API route checks one. */
export const APP_PERMISSIONS = {
    TICKETS_CREATE: 'tickets:create',
    TICKETS_READ: 'tickets:read',
    MESSAGES_READ: 'messages:read',
    MESSAGES_WRITE: 'messages:write',
} as const;

export type AppPermission = typeof APP_PERMISSIONS[keyof typeof APP_PERMISSIONS];

export const ALL_APP_PERMISSIONS: AppPermission[] = Object.values(APP_PERMISSIONS);

/** Request headers of the connected-apps API; same HMAC scheme as iPop. */
export const APP_HEADERS = {
    clientId: 'x-idesk-client-id',
    timestamp: 'x-idesk-timestamp',
    signature: 'x-idesk-signature',
} as const;

/** Lower-case letters, digits and dashes; becomes the tickets' externalSource (max 20). */
export const APP_CLIENT_ID_PATTERN = /^[a-z][a-z0-9-]{1,19}$/;

/** Client ids that would collide with built-in ticket sources. */
export const RESERVED_CLIENT_IDS = ['ipop', 'web', 'email', 'telegram', 'api', 'idesk'];

/** externalSource stored on tickets filed by this app. */
export const appSource = (clientId: string) => clientId.toUpperCase();
