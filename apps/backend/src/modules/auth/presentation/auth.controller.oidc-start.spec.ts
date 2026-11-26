import { AuthController } from './auth.controller';
import { ssoFailureUrl } from './return-to';

describe('AuthController.oidcStart', () => {
    const makeRes = () => ({ redirect: jest.fn(), cookie: jest.fn() });
    const build = (overrides: { refreshToken?: jest.Mock; authorizationUrl?: jest.Mock } = {}) => {
        const authService = {
            refreshToken: overrides.refreshToken ?? jest.fn().mockResolvedValue({
                access_token: 'a', refresh_token: 'r', expiresIn: '1h', refreshExpiresIn: '7d',
            }),
        };
        const ipop = {
            isEnabled: () => true,
            authorizationUrl: overrides.authorizationUrl ?? jest.fn().mockResolvedValue('https://ipop.example/authorize'),
        };
        const jwt = { sign: jest.fn().mockReturnValue('signed-flow') };
        const controller = new AuthController(authService as any, {} as any, ipop as any, {} as any, jwt as any);
        return { controller, authService, ipop, jwt };
    };

    it('redirects straight to returnTo when the session cookie is valid', async () => {
        const { controller, ipop } = build();
        const res = makeRes();
        await controller.oidcStart('/tickets/x', { cookies: { refresh_token: 'rt' } }, res as any);
        expect(res.redirect).toHaveBeenCalledWith('/tickets/x');
        expect(ipop.authorizationUrl).not.toHaveBeenCalled();
        expect(res.cookie).toHaveBeenCalledWith('access_token', 'a', expect.anything());
    });

    it('starts SSO when there is no session cookie', async () => {
        const { controller } = build();
        const res = makeRes();
        await controller.oidcStart('/tickets/x', { cookies: {} }, res as any);
        expect(res.redirect).toHaveBeenCalledWith('https://ipop.example/authorize');
    });

    it('starts SSO when the session is revoked or expired', async () => {
        const { controller } = build({ refreshToken: jest.fn().mockRejectedValue(new Error('revoked')) });
        const res = makeRes();
        await controller.oidcStart('/tickets/x', { cookies: { refresh_token: 'rt' } }, res as any);
        expect(res.redirect).toHaveBeenCalledWith('https://ipop.example/authorize');
    });

    it.each(['https://evil.example/x', '//evil.example', '/\\evil.example'])('rejects external returnTo %s with a valid session', async (bad) => {
        const { controller } = build();
        const res = makeRes();
        await controller.oidcStart(bad, { cookies: { refresh_token: 'rt' } }, res as any);
        expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('sends the user to login with next when discovery fails', async () => {
        const { controller } = build({ authorizationUrl: jest.fn().mockRejectedValue(new Error('discovery')) });
        const res = makeRes();
        await controller.oidcStart('/tickets/x', { cookies: {} }, res as any);
        expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=ipop_unavailable&next=%2Ftickets%2Fx');
    });
});

describe('ssoFailureUrl', () => {
    it('omits next for the root and for unsafe targets', () => {
        expect(ssoFailureUrl('ipop_failed', undefined)).toBe('/login?sso_error=ipop_failed');
        expect(ssoFailureUrl('ipop_failed', 'https://evil.example')).toBe('/login?sso_error=ipop_failed');
    });
});
