import { describeSenderDomainMismatch, extractDomain, extractEmailAddress } from './sender-domain.util';

describe('sender-domain util', () => {
    it('extracts the address from an RFC 5322 display-name form', () => {
        expect(extractEmailAddress('iDesk Support <noreply@idesk.com>')).toBe('noreply@idesk.com');
        expect(extractEmailAddress('noreply@idesk.com')).toBe('noreply@idesk.com');
    });

    it('extracts the domain', () => {
        expect(extractDomain('iDesk Support <noreply@idesk.com>')).toBe('idesk.com');
        expect(extractDomain('not-an-address')).toBe('');
    });

    it('flags the mismatch that produced 550 Authentication rejected', () => {
        const hint = describeSenderDomainMismatch(
            'iDesk Support <noreply@idesk.com>',
            'bagastyo.indrastoto@kapalapi.co.id',
        );
        expect(hint).toContain('idesk.com');
        expect(hint).toContain('kapalapi.co.id');
    });

    it('stays silent when the domains match', () => {
        expect(
            describeSenderDomainMismatch(
                'iDesk Support <noreply@kapalapi.co.id>',
                'bagastyo.indrastoto@kapalapi.co.id',
            ),
        ).toBeNull();
    });

    it('stays silent when either side is unknown', () => {
        expect(describeSenderDomainMismatch('', 'user@kapalapi.co.id')).toBeNull();
        expect(describeSenderDomainMismatch('noreply@kapalapi.co.id', '')).toBeNull();
    });
});
