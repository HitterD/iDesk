import { Request } from 'express';

const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^[0-9a-f:]+$/i;

/**
 * Normalizes an IP address by trimming whitespace, stripping IPv4-mapped IPv6 prefixes (::ffff:),
 * and converting IPv6 loopback (::1) to 127.0.0.1.
 */
export function normalizeIp(value?: string | null): string {
    if (!value) return 'unknown';
    const trimmed = value.trim();
    const withoutPrefix = trimmed.replace(/^::ffff:/i, '');
    return withoutPrefix === '::1' ? '127.0.0.1' : withoutPrefix;
}

/**
 * Validates if the string is a valid IPv4 or IPv6 address.
 */
export function isValidIp(value: string): boolean {
    if (!value || value === 'unknown') return false;
    if (IPV4_PATTERN.test(value)) {
        return value.split('.').every(part => {
            const num = Number(part);
            return num >= 0 && num <= 255;
        });
    }
    return IPV6_PATTERN.test(value) && value.includes(':');
}

export type ClientIpRequest = {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
} | Request | null | undefined;

/**
 * Extracts the true originating client IP address from standard headers and socket.
 */
export function extractClientIp(request: ClientIpRequest): string {
    if (!request) return 'unknown';

    const headers = request.headers || {};

    // 1. X-Forwarded-For
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
        const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        if (typeof raw === 'string') {
            const ips = raw.split(',').map(s => normalizeIp(s)).filter(isValidIp);
            if (ips.length > 0) {
                return ips[0];
            }
        }
    }

    // 2. X-Real-IP
    const realIp = headers['x-real-ip'];
    if (realIp) {
        const raw = Array.isArray(realIp) ? realIp[0] : realIp;
        if (typeof raw === 'string') {
            const normalized = normalizeIp(raw);
            if (isValidIp(normalized)) return normalized;
        }
    }

    // 3. CF-Connecting-IP
    const cfIp = headers['cf-connecting-ip'];
    if (cfIp) {
        const raw = Array.isArray(cfIp) ? cfIp[0] : cfIp;
        if (typeof raw === 'string') {
            const normalized = normalizeIp(raw);
            if (isValidIp(normalized)) return normalized;
        }
    }

    // 4. Express request.ip
    if (request.ip) {
        const normalized = normalizeIp(request.ip);
        if (isValidIp(normalized)) return normalized;
    }

    // 5. Direct socket address
    if (request.socket?.remoteAddress) {
        const normalized = normalizeIp(request.socket.remoteAddress);
        if (isValidIp(normalized)) return normalized;
    }

    return 'unknown';
}

/**
 * Resolve the client IP for rate limiting, trusting `X-Forwarded-For` only as
 * far as the configured proxy count vouches for it.
 *
 * Semantics (mirrors nginx/Express trust-proxy-by-hop count):
 * - TRUSTED_PROXY_COUNT unset/0/empty → XFF is client-controlled: ignore it
 *   entirely and use the direct socket address. A forged header must not
 *   let an attacker defeat per-IP rate limiting.
 * - TRUSTED_PROXY_COUNT = N → the app sits behind N trusted reverse proxies
 *   (e.g. nginx → app). Each proxy appends the address it saw to the right of
 *   X-Forwarded-For, so the real client is the Nth-from-the-right entry of the
 *   XFF list; entries to its right are the proxies' own addresses.
 *
 * Malformed values fall back to the socket address (never throw).
 */
export function getTrustedClientIp(request: Request): string {
    const direct = extractDirectClientIp(request);

    const rawCount = process.env.TRUSTED_PROXY_COUNT;
    const count = rawCount === undefined || rawCount === '' ? 0 : Number(rawCount);
    if (!Number.isInteger(count) || count <= 0) {
        return direct;
    }

    const forwarded = request.headers?.['x-forwarded-for'];
    if (!forwarded) return direct;

    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw !== 'string') return direct;

    // XFF is ordered client→proxy; the client is the Nth-from-the-right entry.
    const ips = raw
        .split(',')
        .map((s) => normalizeIp(s))
        .filter(isValidIp);
    if (ips.length === 0) return direct;
    // When the XFF has MORE entries than the count, take the Nth-from-the-right
    // (the trusted zone starts there). When it has FEWER (e.g. proxies that
    // overwrite XFF keep a single entry), fall back to the rightmost entry —
    // that is the address the closest proxy actually saw, still more useful
    // than the proxy's own socket address for per-IP throttling.
    return ips[ips.length - Math.min(count, ips.length)];
}

/**
 * Direct socket/address IP, ignoring all forwarding headers.
 */
function extractDirectClientIp(request: Request): string {
    // 1. Express request.ip (set from the socket when Express trust proxy is off)
    if (request.ip) {
        const normalized = normalizeIp(request.ip);
        if (isValidIp(normalized)) return normalized;
    }

    // 2. Direct socket address
    if (request.socket?.remoteAddress) {
        const normalized = normalizeIp(request.socket.remoteAddress);
        if (isValidIp(normalized)) return normalized;
    }

    // 3. X-Real-IP / CF-Connecting-IP when present — these are set by the proxy
    //    itself (not attacker-controlled in the same way as XFF) and mirror the
    //    direct path used by extractClientIp. Only consulted when no count is set.
    const realIp = request.headers?.['x-real-ip'];
    if (realIp) {
        const raw = Array.isArray(realIp) ? realIp[0] : realIp;
        if (typeof raw === 'string') {
            const normalized = normalizeIp(raw);
            if (isValidIp(normalized)) return normalized;
        }
    }

    return 'unknown';
}
