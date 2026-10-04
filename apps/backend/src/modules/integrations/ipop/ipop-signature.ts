import { createHmac, timingSafeEqual } from 'crypto';

/** Request headers of the iPop integration (both directions). */
export const IPOP_HEADERS = {
    clientId: 'x-ipop-client-id',
    timestamp: 'x-ipop-timestamp',
    signature: 'x-ipop-signature',
} as const;

/** Allowed clock skew between iPop and iDesk. */
export const IPOP_MAX_SKEW_MS = 5 * 60 * 1000;
/** Shorter secrets are refused: the HMAC is only as strong as the key. */
export const IPOP_MIN_SECRET_LENGTH = 32;

/**
 * hex(HMAC-SHA256(secret, `${timestamp}.${body}`)). `body` is the exact bytes sent
 * (empty string for GET), `timestamp` is Unix epoch milliseconds as a string.
 */
export function signIpopPayload(secret: string, timestamp: string, body: Buffer | string): string {
    return createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
}

export function isValidIpopSignature(
    secret: string,
    timestamp: string,
    body: Buffer | string,
    signature: string,
): boolean {
    const expected = Buffer.from(signIpopPayload(secret, timestamp, body), 'utf8');
    const given = Buffer.from(signature.trim().toLowerCase(), 'utf8');
    return expected.length === given.length && timingSafeEqual(expected, given);
}

export function isFreshIpopTimestamp(timestamp: string, now: number = Date.now()): boolean {
    if (!/^\d{10,16}$/.test(timestamp)) return false;
    return Math.abs(now - Number(timestamp)) <= IPOP_MAX_SKEW_MS;
}

/** Headers for a signed callback from iDesk to iPop. */
export function signedIpopHeaders(clientId: string, secret: string, body: string, now: number = Date.now()): Record<string, string> {
    const timestamp = String(now);
    return {
        'Content-Type': 'application/json',
        [IPOP_HEADERS.clientId]: clientId,
        [IPOP_HEADERS.timestamp]: timestamp,
        [IPOP_HEADERS.signature]: signIpopPayload(secret, timestamp, body),
    };
}
