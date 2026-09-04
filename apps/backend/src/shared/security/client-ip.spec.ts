import { getTrustedClientIp } from './client-ip';

function request(remoteAddress: string, forwarded?: string): any {
    return {
        socket: { remoteAddress },
        ip: remoteAddress,
        headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    };
}

describe('getTrustedClientIp', () => {
    const previous = process.env.TRUSTED_PROXY_COUNT;

    afterEach(() => {
        if (previous === undefined) delete process.env.TRUSTED_PROXY_COUNT;
        else process.env.TRUSTED_PROXY_COUNT = previous;
    });

    it('uses socket address when proxy trust is disabled', () => {
        delete process.env.TRUSTED_PROXY_COUNT;
        expect(getTrustedClientIp(request('10.0.0.2', '203.0.113.5'))).toBe('10.0.0.2');
    });

    it('uses client address through configured proxy count', () => {
        process.env.TRUSTED_PROXY_COUNT = '1';
        expect(getTrustedClientIp(request('10.0.0.2', '203.0.113.5'))).toBe('203.0.113.5');
    });

    it('rejects malformed forwarded values', () => {
        process.env.TRUSTED_PROXY_COUNT = '1';
        expect(getTrustedClientIp(request('10.0.0.2', 'not-an-ip'))).toBe('10.0.0.2');
    });

    it('normalizes IPv4-mapped IPv6 addresses', () => {
        delete process.env.TRUSTED_PROXY_COUNT;
        expect(getTrustedClientIp(request('::ffff:192.0.2.1'))).toBe('192.0.2.1');
    });

    it('takes the Nth-from-the-right XFF entry with a multi-proxy chain', () => {
        process.env.TRUSTED_PROXY_COUNT = '2';
        expect(
            getTrustedClientIp(request('10.0.0.3', '203.0.113.7, 198.51.100.2, 20.0.0.1')),
        ).toBe('198.51.100.2');
    });

    it('falls back to the rightmost entry when XFF is shorter than the proxy count', () => {
        // Proxy that overwrites XFF keeps a single entry; count is still 2.
        process.env.TRUSTED_PROXY_COUNT = '2';
        expect(
            getTrustedClientIp(request('10.0.0.2', '203.0.113.5')),
        ).toBe('203.0.113.5');
    });
});
