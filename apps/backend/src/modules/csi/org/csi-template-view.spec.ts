import { buildTemplateView, resolveRater } from './csi-template-view';

const confirmedAt = new Date('2026-11-10T00:00:00Z');
const rater = (patch = {}) => ({ raterName: 'ELVI CYNTHIA', raterNik: null, userId: null, confirmedAt: null, ...patch });
const pic = { id: 'p1', area: 'HC Services', serviceCode: 'HCS', picName: 'X', jobTitle: null, serviceFunction: null, picId: null, sortOrder: 0 };
const template = { id: 't', scope: 'HC', locationCode: 'SMG', name: 'T' };

describe('resolveRater', () => {
    const accounts = [{ id: 'u1', fullName: 'Elvi Cynthia', employeeId: '277' }];
    it('keeps an active unconfirmed pin ok', () => {
        expect(resolveRater(rater({ raterName: 'BUDI', userId: 'u1' }), accounts)).toEqual({ userId: 'u1', status: 'ok' });
    });
    it('is confirmed when pinned and confirmedAt, before checking NIK', () => {
        const others = [...accounts, { id: 'u2', fullName: 'Budi', employeeId: '278' }];
        expect(resolveRater(rater({ userId: 'u1', confirmedAt, raterNik: '278' }), others)).toEqual({ userId: 'u1', status: 'confirmed' });
    });
    it('NIK match beats ambiguous name and an unconfirmed pin, normalising both sides', () => {
        const sameNames = [...accounts, { id: 'u2', fullName: 'Elvi Cynthia', employeeId: ' 00000278 ' }];
        expect(resolveRater(rater({ userId: 'u1', raterNik: '278' }), sameNames)).toEqual({ userId: 'u2', status: 'confirmed' });
        expect(resolveRater(rater({ raterNik: ' 00000277 ' }), sameNames)).toEqual({ userId: 'u1', status: 'confirmed' });
    });
    it('inactive pinned account falls back to the name even with confirmedAt', () => {
        expect(resolveRater(rater({ userId: 'u-inactive', confirmedAt }), accounts)).toEqual({ userId: 'u1', status: 'ok' });
        expect(resolveRater(rater({ raterName: 'BUDI', userId: 'u-inactive', confirmedAt }), accounts)).toEqual({ userId: null, status: 'no-account' });
    });
    it('duplicate normalised NIK falls back to the unconfirmed pin or name', () => {
        const duplicate = [...accounts, { id: 'u2', fullName: 'Elvi Cynthia', employeeId: '00000277' }];
        expect(resolveRater(rater({ raterNik: '277', userId: 'u1' }), duplicate)).toEqual({ userId: 'u1', status: 'ok' });
        expect(resolveRater(rater({ raterNik: '277' }), duplicate)).toEqual({ userId: null, status: 'ambiguous' });
        expect(resolveRater(rater({ raterName: 'BUDI', raterNik: '277' }), duplicate)).toEqual({ userId: null, status: 'no-account' });
    });
    it('blank NIKs do not confirm and an unmatched NIK falls back to name', () => {
        const blank = [{ id: 'u1', fullName: 'Elvi Cynthia', employeeId: null }];
        expect(resolveRater(rater({ raterNik: ' ' }), blank)).toEqual({ userId: 'u1', status: 'ok' });
        expect(resolveRater(rater({ raterNik: '999' }), accounts)).toEqual({ userId: 'u1', status: 'ok' });
    });
});

describe('buildTemplateView', () => {
    it('summary counts confirmed separately and exposes NIK and confirmation state', () => {
        const raters = [rater({ userId: 'u1', confirmedAt, raterNik: '277' }), rater(), rater({ raterName: 'Unknown' }), rater({ raterName: 'Same' })]
            .map((row, index) => ({ ...row, id: `r${index}`, templatePicId: 'p1', raterJobTitle: null }));
        const accounts = [{ id: 'u1', fullName: 'Elvi Cynthia', employeeId: '277' },
            { id: 'u2', fullName: 'Same', employeeId: null }, { id: 'u3', fullName: 'Same', employeeId: null }];
        const view = buildTemplateView(template, [pic], raters, accounts);
        expect(view.summary).toMatchObject({ raters: 4, ratersConfirmed: 1, ratersOk: 1, ratersAmbiguous: 1, ratersNoAccount: 1 });
        expect(view.pics[0].raters.find((row) => row.id === 'r0')).toMatchObject({ raterNik: '277', confirmed: true });
        view.pics[0].raters.filter((row) => row.id !== 'r0').forEach((row) => expect(row).toMatchObject({ confirmed: false }));
    });
    it('reads each account name once, not once per rater', () => {
        const fullNames: string[] = [];
        const accounts = Array.from({ length: 50 }, (_, index) => ({ id: `u${index}`, employeeId: null, get fullName() { fullNames.push('x'); return `USER ${index}`; } }));
        const raters = Array.from({ length: 40 }, (_, index) => ({ ...rater({ raterName: `USER ${index}` }), id: `r${index}`, templatePicId: 'p1', raterJobTitle: null }));
        const view = buildTemplateView(template, [pic], raters, accounts);
        expect(view.summary.ratersOk).toBe(40);
        expect(fullNames.length).toBeLessThanOrEqual(accounts.length);
    });

    it('exposes the custom team of a team row (null for PIC rows)', () => {
        const view = buildTemplateView(template, [pic, { ...pic, id: 'p2', picName: 'TIM A', teamId: 'team-a', sortOrder: 1 }], [], []);
        expect(view.pics.map((row) => row.teamId)).toEqual([null, 'team-a']);
    });
});
