import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IpopAuthGuard } from '../ipop-auth.guard';
import { IPOP_HEADERS, signIpopPayload, signedIpopHeaders } from '../ipop-signature';

const SECRET = 'x'.repeat(40);
const CLIENT = 'ipop';

const guardWith = (env: Record<string, string | undefined>) =>
    new IpopAuthGuard({ get: (k: string) => env[k] } as any);

const ctx = (headers: Record<string, string>, rawBody?: Buffer) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers, rawBody, method: 'POST', originalUrl: '/v1/integrations/ipop/tickets' }) }),
}) as any;

describe('IpopAuthGuard', () => {
    const guard = guardWith({ IPOP_CLIENT_ID: CLIENT, IPOP_CLIENT_SECRET: SECRET });
    const body = Buffer.from('{"title":"Printer"}');

    it('accepts a request signed over the exact raw body', () => {
        const ts = String(Date.now());
        const headers = {
            [IPOP_HEADERS.clientId]: CLIENT,
            [IPOP_HEADERS.timestamp]: ts,
            [IPOP_HEADERS.signature]: signIpopPayload(SECRET, ts, body),
        };
        expect(guard.canActivate(ctx(headers, body))).toBe(true);
    });

    it('accepts a GET signed over an empty body', () => {
        const headers = signedIpopHeaders(CLIENT, SECRET, '');
        expect(guard.canActivate(ctx(headers))).toBe(true);
    });

    it('rejects a body changed after signing', () => {
        const ts = String(Date.now());
        const headers = {
            [IPOP_HEADERS.clientId]: CLIENT,
            [IPOP_HEADERS.timestamp]: ts,
            [IPOP_HEADERS.signature]: signIpopPayload(SECRET, ts, body),
        };
        expect(() => guard.canActivate(ctx(headers, Buffer.from('{"title":"Printer!"}')))).toThrow(UnauthorizedException);
    });

    it('rejects a replay outside the 5 minute window', () => {
        const ts = String(Date.now() - 6 * 60 * 1000);
        const headers = {
            [IPOP_HEADERS.clientId]: CLIENT,
            [IPOP_HEADERS.timestamp]: ts,
            [IPOP_HEADERS.signature]: signIpopPayload(SECRET, ts, body),
        };
        expect(() => guard.canActivate(ctx(headers, body))).toThrow(/timestamp/);
    });

    it('rejects an unknown client and missing headers', () => {
        const ts = String(Date.now());
        expect(() => guard.canActivate(ctx({
            [IPOP_HEADERS.clientId]: 'someone-else',
            [IPOP_HEADERS.timestamp]: ts,
            [IPOP_HEADERS.signature]: signIpopPayload(SECRET, ts, body),
        }, body))).toThrow(/Unknown iPop client/);
        expect(() => guard.canActivate(ctx({}, body))).toThrow(/Missing/);
    });

    it('fails closed when the integration is not configured or the secret is weak', () => {
        expect(() => guardWith({ IPOP_CLIENT_ID: CLIENT }).canActivate(ctx({}))).toThrow(ServiceUnavailableException);
        expect(() => guardWith({ IPOP_CLIENT_ID: CLIENT, IPOP_CLIENT_SECRET: 'short' }).canActivate(ctx({}))).toThrow(ServiceUnavailableException);
    });
});
