import { buildTemplateView, resolveRater } from './csi-template-view';

describe('resolveRater', () => {
    const accounts = [{ id: 'u1', fullName: 'Elvi Cynthia' }];
    it('a rater pinned to an account that is no longer active is not ok', () => {
        expect(resolveRater({ raterName: 'BUDI', userId: 'u-inactive' }, accounts)).toEqual({ userId: null, status: 'no-account' });
        expect(resolveRater({ raterName: 'BUDI', userId: 'u1' }, accounts)).toEqual({ userId: 'u1', status: 'ok' });
    });
    it('falls back to the name when the pinned account is gone', () => {
        expect(resolveRater({ raterName: 'ELVI CYNTHIA', userId: 'u-inactive' }, accounts)).toEqual({ userId: 'u1', status: 'ok' });
    });
});

describe('buildTemplateView', () => {
    it('reads each account name once, not once per rater', () => {
        const fullNames: string[] = [];
        const accounts = Array.from({ length: 50 }, (_, index) => ({ id: `u${index}`, get fullName() { fullNames.push('x'); return `USER ${index}`; } }));
        const raters = Array.from({ length: 40 }, (_, index) => ({ id: `r${index}`, templatePicId: 'p1', raterName: `USER ${index}`, raterJobTitle: null, userId: null }));
        const view = buildTemplateView({ id: 't', scope: 'HC', locationCode: 'SMG', name: 'T' },
            [{ id: 'p1', area: 'HC Services', serviceCode: 'HCS', picName: 'X', jobTitle: null, serviceFunction: null, picId: null, sortOrder: 0 }], raters, accounts);
        expect(view.summary.ratersOk).toBe(40);
        expect(fullNames.length).toBeLessThanOrEqual(accounts.length);
    });
});
