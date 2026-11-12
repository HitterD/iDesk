import { AuthService } from './auth.service';

/** S2S callers get the account's site code; it is read from the sites table so new sites (SKD) need no code change. */
describe('AuthService.siteCodeOf', () => {
    const findSiteCode = jest.fn();
    const service = new AuthService({ findSiteCode } as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    beforeEach(() => findSiteCode.mockReset());

    it('uses the code of the account site from the database', async () => {
        findSiteCode.mockResolvedValue('SKD');
        await expect(service.siteCodeOf({ siteId: 'site-skd', email: 'a@x' })).resolves.toBe('SKD');
        expect(findSiteCode).toHaveBeenCalledWith('site-skd');
    });

    it('falls back to SPJ when the site id is unknown', async () => {
        findSiteCode.mockResolvedValue(null);
        await expect(service.siteCodeOf({ siteId: 'gone', email: 'krw@x' })).resolves.toBe('SPJ');
    });

    it('guesses from the email when the account has no site', async () => {
        await expect(service.siteCodeOf({ siteId: null, email: 'budi.krw@x' })).resolves.toBe('KRW');
        await expect(service.siteCodeOf({ siteId: null, email: 'budi.skd@x' })).resolves.toBe('SKD');
        await expect(service.siteCodeOf({ siteId: null, email: 'budi@x' })).resolves.toBe('SPJ');
        expect(findSiteCode).not.toHaveBeenCalled();
    });
});
