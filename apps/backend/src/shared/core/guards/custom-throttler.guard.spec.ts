import { JwtService } from '@nestjs/jwt';
import { CustomThrottlerGuard } from './custom-throttler.guard';

const createGuard = () => {
    const guard = Object.create(CustomThrottlerGuard.prototype) as CustomThrottlerGuard;
    (guard as any).tokenVerifier = new JwtService();
    return guard;
};

const signAccessToken = (sub: string, secret = process.env.JWT_SECRET as string) =>
    new JwtService().sign({ sub, type: 'access' }, { secret });

const baseRequest = (overrides: Record<string, any> = {}) => ({
    path: '/tickets',
    route: { path: '/tickets' },
    socket: { remoteAddress: '192.0.2.10' },
    ip: '192.0.2.10',
    headers: {},
    ...overrides,
});

describe('CustomThrottlerGuard', () => {
    it('uses trusted IP plus account scope for auth requests', async () => {
        const guard = createGuard();
        const request = baseRequest({
            path: '/auth/login',
            route: { path: '/auth/login' },
            body: { email: ' User@Example.com ' },
            cookies: { access_token: signAccessToken('user-1') },
        });
        const context = {
            switchToHttp: () => ({ getRequest: () => request }),
            getClass: () => ({ name: 'AuthController' }),
            getHandler: () => ({ name: 'login' }),
        } as any;

        const tracker = await (guard as any).getTracker(request);
        const key = (guard as any).generateKey(context, tracker, 'default');
        expect(tracker).toBe('192.0.2.10');
        expect(key).toContain('user@example.com');
    });

    it('tracks authenticated requests per user (cookie)', async () => {
        const tracker = await (createGuard() as any).getTracker(
            baseRequest({ cookies: { access_token: signAccessToken('user-1') } }),
        );
        expect(tracker).toBe('user:user-1');
    });

    it('tracks authenticated requests per user (Bearer header)', async () => {
        const tracker = await (createGuard() as any).getTracker(
            baseRequest({ headers: { authorization: `Bearer ${signAccessToken('user-2')}` } }),
        );
        expect(tracker).toBe('user:user-2');
    });

    it('gives users behind the same IP separate trackers', async () => {
        const guard = createGuard() as any;
        const a = await guard.getTracker(baseRequest({ cookies: { access_token: signAccessToken('a') } }));
        const b = await guard.getTracker(baseRequest({ cookies: { access_token: signAccessToken('b') } }));
        expect(a).not.toBe(b);
    });

    it('falls back to IP for forged or missing tokens', async () => {
        const guard = createGuard() as any;
        const forged = signAccessToken('attacker', 'x'.repeat(40));
        expect(await guard.getTracker(baseRequest({ cookies: { access_token: forged } }))).toBe('192.0.2.10');
        expect(await guard.getTracker(baseRequest())).toBe('192.0.2.10');
    });
});
