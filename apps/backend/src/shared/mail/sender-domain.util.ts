/**
 * Relays generally refuse to send a message whose sender is not a mailbox the
 * authenticated account owns, answering with a bare `550 5.7.0 Authentication
 * rejected`. The SMTP login itself succeeds, so the Settings "verify
 * connection" action reports success and only the actual send fails - a
 * confusing combination. These helpers turn that into a message the
 * administrator can act on.
 *
 * Two independent stages can be rejected, and nodemailer names them
 * differently: "Mail command failed" is the `MAIL FROM` verb (envelope
 * sender), "Message failed" is the message body (From header). A relay may
 * enforce either, or - like mail.kapalapi.co.id - both.
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

/** Explains why one address is not accepted in place of the login mailbox. */
function describeAddress(label: string, address: string, account: string): string {
    return extractDomain(address) === extractDomain(account)
        ? `The ${label} "${address}" shares the domain but is not the authenticated mailbox.`
        : `The ${label} "${address}" is outside the account's domain.`;
}

/**
 * Returns a hint when the envelope sender or the From header is not the
 * authenticated mailbox, or null when both already match.
 *
 * Verified against mail.kapalapi.co.id with a raw SMTP dialog: with
 * `MAIL FROM:<bagastyo.indrastoto@kapalapi.co.id>` accepted, a message headed
 * `From: <noreply@kapalapi.co.id>` was still answered `550 5.7.0
 * Authentication rejected` at DATA, while the same message headed with the
 * login mailbox was accepted `250 2.6.0 Ok, message saved`. A display name is
 * fine - only the address is checked.
 */
export function describeSenderDomainMismatch(
    fromAddress: string,
    username: string,
    envelopeFrom?: string,
): string | null {
    const account = extractEmailAddress(username || '');
    if (!account) return null;

    const header = extractEmailAddress(fromAddress || '');
    const envelope = extractEmailAddress(envelopeFrom || fromAddress || '');

    const reasons: string[] = [];
    const fixes: string[] = [];
    if (envelope && envelope !== account) {
        reasons.push(describeAddress('envelope sender', envelope, account));
        fixes.push(`set "Envelope sender" to "${account}"`);
    }
    if (header && header !== account) {
        reasons.push(describeAddress('From header', header, account));
        fixes.push(`set "From address" to "${account}" (a display name such as "iDesk Support <${account}>" is fine)`);
    }
    if (!reasons.length) return null;

    return (
        `${reasons.join(' ')} The SMTP account is "${account}". ` +
        `In Settings > Email, ${fixes.join(' and ')}.`
    );
}
