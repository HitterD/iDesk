import { isRaterInAudience } from './csi-rater-audience.util';

const rater = (over: Record<string, unknown> = {}) => ({ id: 'pr1', user: { isActive: true, siteId: 'site-a' }, ...over });

describe('isRaterInAudience', () => {
    const sites = ['site-a', 'site-b'];

    it('an active rater of a period site in an unmapped period is in the audience', () => {
        expect(isRaterInAudience(rater(), sites, null)).toBe(true);
    });

    it('a rater whose account is at another site or inactive never sees the survey (same rule as the SLA basis)', () => {
        expect(isRaterInAudience(rater({ user: { isActive: true, siteId: 'site-x' } }), sites, null)).toBe(false);
        expect(isRaterInAudience(rater({ user: { isActive: true, siteId: null } }), sites, null)).toBe(false);
        expect(isRaterInAudience(rater({ user: { isActive: false, siteId: 'site-a' } }), sites, null)).toBe(false);
        expect(isRaterInAudience(rater({ user: undefined }), sites, null)).toBe(false);
    });

    it('in a mapped period only raters with at least one pair count', () => {
        expect(isRaterInAudience(rater(), sites, new Set(['pr1']))).toBe(true);
        expect(isRaterInAudience(rater(), sites, new Set(['pr2']))).toBe(false);
    });
});
