import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import {
    IPOP_HEADERS,
    IPOP_MIN_SECRET_LENGTH,
    isFreshIpopTimestamp,
    isValidIpopSignature,
} from './ipop-signature';

/** Raw request bytes captured by the JSON parser in main.ts (absent for multipart). */
type RawBodyRequest = Request & { rawBody?: Buffer };

const sameText = (a: string, b: string): boolean => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Authenticates the iPop server: client id + HMAC-SHA256 over `${timestamp}.${rawBody}`
 * with iPop's own secret (not shared with SJA, so it can be rotated alone).
 *
 * Every iPop request is JSON (attachments travel base64-encoded inside it), so the
 * signature always covers the complete request, files included. GET requests sign an
 * empty body.
 */
@Injectable()
export class IpopAuthGuard implements CanActivate {
    private readonly logger = new Logger(IpopAuthGuard.name);

    constructor(private readonly config: ConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const clientId = this.config.get<string>('IPOP_CLIENT_ID')?.trim();
        const secret = this.config.get<string>('IPOP_CLIENT_SECRET')?.trim();
        if (!clientId || !secret || secret.length < IPOP_MIN_SECRET_LENGTH) {
            throw new ServiceUnavailableException('iPop integration is not configured');
        }

        const req = context.switchToHttp().getRequest<RawBodyRequest>();
        const header = (name: string) => {
            const value = req.headers[name];
            return typeof value === 'string' ? value.trim() : '';
        };
        const givenClient = header(IPOP_HEADERS.clientId);
        const timestamp = header(IPOP_HEADERS.timestamp);
        const signature = header(IPOP_HEADERS.signature);

        if (!givenClient || !timestamp || !signature) {
            throw new UnauthorizedException('Missing iPop authentication headers');
        }
        if (!sameText(givenClient, clientId)) {
            throw new UnauthorizedException('Unknown iPop client');
        }
        if (!isFreshIpopTimestamp(timestamp)) {
            throw new UnauthorizedException('iPop request timestamp is outside the allowed window');
        }
        const body = req.rawBody ?? Buffer.alloc(0);
        if (!isValidIpopSignature(secret, timestamp, body, signature)) {
            this.logger.warn(`Rejected iPop request with a bad signature: ${req.method} ${req.originalUrl}`);
            throw new UnauthorizedException('Invalid iPop signature');
        }
        return true;
    }
}
