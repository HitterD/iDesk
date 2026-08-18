import { describeSenderDomainMismatch, extractDomain, extractEmailAddress } from './sender-domain.util';

const ACCOUNT = 'bagastyo.indrastoto@kapalapi.co.id';

describe('sender-domain util', () => {
    it('extracts the address from an RFC 5322 display-name form', () => {
        expect(extractEmailAddress('iDesk Support <noreply@idesk.com>')).toBe('noreply@idesk.com');
        expect(extractEmailAddress('noreply@idesk.com')).toBe('noreply@idesk.com');
    });

    it('extracts the domain', () => {
        expect(extractDomain('iDesk Support <noreply@idesk.com>')).toBe('idesk.com');
        expect(extractDomain('not-an-address')).toBe('');
    });

    it('flags a From address outside the account domain', () => {
        const hint = describeSenderDomainMismatch('iDesk Support <noreply@idesk.com>', ACCOUNT);
        expect(hint).toContain("outside the account's domain");
        expect(hint).toContain(ACCOUNT);
    });

    // Reproduces the live rejection: the relay accepted MAIL FROM for the login
    // mailbox and answered 550 for noreply@ on the very same domain.
    it('flags a same-domain address that is not the authenticated mailbox', () => {
        const hint = describeSenderDomainMismatch('iDesk Support <noreply@kapalapi.co.id>', ACCOUNT);
        expect(hint).toContain('shares the domain but is not the authenticated mailbox');
    });

    // A raw SMTP dialog proved the From header is checked separately from the
    // envelope: MAIL FROM for the login mailbox was accepted, then DATA carrying
    // `From: <noreply@kapalapi.co.id>` was still answered 550. Fixing only the
    // envelope must therefore keep warning about the header.
    it('still flags the From header when only the envelope sender is corrected', () => {
        const hint = describeSenderDomainMismatch('iDesk Support <noreply@kapalapi.co.id>', ACCOUNT, ACCOUNT);
        expect(hint).toContain('From header');
        expect(hint).not.toContain('envelope sender');
    });

    it('names both stages when neither matches the account', () => {
        const hint = describeSenderDomainMismatch('iDesk Support <noreply@idesk.com>', ACCOUNT, 'relay@idesk.com');
        expect(hint).toContain('envelope sender');
        expect(hint).toContain('From header');
    });

    it('stays silent once both sender stages use the authenticated mailbox', () => {
        expect(describeSenderDomainMismatch(`iDesk Support <${ACCOUNT}>`, ACCOUNT, ACCOUNT)).toBeNull();
        // A display name alone must not be mistaken for a different sender.
        expect(describeSenderDomainMismatch(`iDesk Support <${ACCOUNT}>`, ACCOUNT)).toBeNull();
    });

    it('stays silent when the account is unknown', () => {
        expect(describeSenderDomainMismatch('noreply@kapalapi.co.id', '')).toBeNull();
    });
});
