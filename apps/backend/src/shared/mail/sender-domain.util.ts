/**
 * Relays generally refuse to send a message whose From header belongs to a
 * domain the authenticated account does not own, answering with a bare
 * `550 5.7.0 Authentication rejected`. The SMTP login itself succeeds, so the
 * Settings "verify connection" action reports success and only the actual send
 * fails — a confusing combination. These helpers turn that into a message the
 * administrator can act on.
 */

/** Extracts the address from `Name <user@host>` or a bare `user@host`. */
export function extractEmailAddress(value: string): string {
    const angled = value.match(/<([^>]+)>/);
    return (angled ? angled[1] : value).trim().toLowerCase();
}

/** Domain part of an address, or '' when the value is not an address. */
export function extractDomain(value: string): string {
    const at = extractEmailAddress(value).lastIndexOf('@');
    return at === -1 ? '' : extractEmailAddress(value).slice(at + 1);
}

/**
 * Returns a hint when the From domain differs from the authenticated user's
 * domain, or null when they match or either side is unknown.
 */
export function describeSenderDomainMismatch(
    fromAddress: string,
    username: string,
): string | null {
    const fromDomain = extractDomain(fromAddress || '');
    const authDomain = extractDomain(username || '');
    if (!fromDomain || !authDomain || fromDomain === authDomain) return null;
    return (
        `From address uses domain "${fromDomain}" while the SMTP account is "${authDomain}". ` +
        `Most relays reject that. Use an address on "${authDomain}" as the From address.`
    );
}
