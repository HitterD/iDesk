import { Request } from 'express';

const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^[0-9a-f:]+$/i;

export function getTrustedClientIp(request: Request): string {
    const directIp = normalizeIp(request.socket?.remoteAddress || request.ip || 'unknown');
    const trustedProxyCount = parseProxyCount(process.env.TRUSTED_PROXY_COUNT);
    if (trustedProxyCount === 0) return directIp;

    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded !== 'string') return directIp;

    const chain = forwarded.split(',').map(normalizeIp).filter(isValidIp);
    if (chain.length < trustedProxyCount) return directIp;
    return chain[Math.max(0, chain.length - trustedProxyCount)] || directIp;
}

function parseProxyCount(value?: string): number {
    if (!value || !/^\d+$/.test(value)) return 0;
    return Math.min(Number(value), 10);
}

function normalizeIp(value: string): string {
    const ip = value.trim().replace(/^::ffff:/i, '');
    return ip === '::1' ? '127.0.0.1' : ip;
}

function isValidIp(value: string): boolean {
    if (IPV4_PATTERN.test(value)) {
        return value.split('.').every(part => Number(part) <= 255);
    }
    return IPV6_PATTERN.test(value) && value.includes(':');
}
