/** How the computer name on a ticket was found. */
export enum HostnameSource {
    /** Reported by the desktop app (iPop notifier) heartbeat. */
    AGENT = 'AGENT',
    /** Reverse DNS (PTR) of the requester's IP. */
    RDNS = 'RDNS',
}

/** A heartbeat this recent counts as "the computer the user is on now". */
export const HEARTBEAT_FRESH_MS = 15 * 60 * 1000;
/** Other computers shown to agents next to the ticket's own. */
export const RECENT_DEVICES_LIMIT = 3;
/** Reverse DNS must never hold ticket creation up for long. */
export const RDNS_TIMEOUT_MS = 1500;
/** Set to "false" when the server cannot reach the office DNS (see docs/integrations/device-heartbeat.md). */
export const RDNS_ENV_FLAG = 'REQUESTER_RDNS_ENABLED';

export const HOSTNAME_MAX = 253;
export const IP_MAX = 45;
/** Letters, digits, dots and dashes; must start with a letter or digit (NetBIOS names and FQDNs). */
export const HOSTNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;
