import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppAuthGuard } from '../app-auth.guard';
import { signIpopPayload } from '../../ipop/ipop-signature';
import { APP_HEADERS, APP_PERMISSIONS } from '../integration-app.constants';

const SECRET = 's'.repeat(43);
const app = { id: 'a-1', clientId: 'ebbk', permissions: [APP_PERMISSIONS.TICKETS_CREATE], modules: ['web-developer'], lastUsedAt: null };

function setup(needed?: string, resolved: unknown = { app, secret: SECRET }) {
    const apps = { resolveActive: jest.fn(async () => resolved), touch: jest.fn(async () => undefined) };
    const reflector = { getAllAndOverride: jest.fn(() => needed) } as unknown as Reflector;
    return { guard: new AppAuthGuard(apps as any, reflector), apps };
}

const signedCtx = (body: string, overrides: Record<string, string> = {}) => {
    const ts = String(Date.now());
    const req: any = {
        method: 'POST', originalUrl: '/v1/integrations/apps/tickets', rawBody: Buffer.from(body),
        headers: { [APP_HEADERS.clientId]: 'ebbk', [APP_HEADERS.timestamp]: ts, [APP_HEADERS.signature]: signIpopPayload(SECRET, ts, body), ...overrides },
    };
    return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => null, getClass: () => null } as any };
};

describe('AppAuthGuard', () => {
    it('lets a correctly signed app through and attaches it to the request', async () => {
        const { guard, apps } = setup(APP_PERMISSIONS.TICKETS_CREATE);
        const { req, ctx } = signedCtx('{"title":"x"}');

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(req.integrationApp).toBe(app);
        expect(apps.touch).toHaveBeenCalledWith(app);
    });

    it('rejects a body changed after signing', async () => {
        const { guard } = setup();
        const { req, ctx } = signedCtx('{"title":"x"}');
        req.rawBody = Buffer.from('{"title":"y"}');
        await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects unknown or disabled apps', async () => {
        const { guard } = setup(undefined, null);
        await expect(guard.canActivate(signedCtx('{}').ctx)).rejects.toThrow('Unknown or disabled app');
    });

    it('rejects stale timestamps', async () => {
        const { guard } = setup();
        const old = String(Date.now() - 10 * 60_000);
        const { ctx } = signedCtx('{}', { [APP_HEADERS.timestamp]: old, [APP_HEADERS.signature]: signIpopPayload(SECRET, old, '{}') });
        await expect(guard.canActivate(ctx)).rejects.toThrow('outside the allowed window');
    });

    it('refuses a feature the admin did not grant', async () => {
        const { guard } = setup(APP_PERMISSIONS.MESSAGES_WRITE);
        await expect(guard.canActivate(signedCtx('{}').ctx)).rejects.toBeInstanceOf(ForbiddenException);
    });
});
