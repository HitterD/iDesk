import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
    it('uses trusted IP plus account scope for auth requests', async () => {
        const guard = Object.create(CustomThrottlerGuard.prototype) as CustomThrottlerGuard;
        const request = {
            path: '/auth/login',
            route: { path: '/auth/login' },
            body: { email: ' User@Example.com ' },
            socket: { remoteAddress: '192.0.2.10' },
            ip: '192.0.2.10',
            headers: {},
        };
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
});
