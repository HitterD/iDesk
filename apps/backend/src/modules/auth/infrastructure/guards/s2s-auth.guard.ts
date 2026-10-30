import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class S2sAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const expectedSecret = process.env.SJA_INTERNAL_SECRET || process.env.IDESK_APP_SECRET;

    if (!expectedSecret || expectedSecret.trim().length < 16) {
      throw new UnauthorizedException('S2S endpoint is not configured: secret is unset or too short');
    }

    // 1. Direct S2S Token check (x-s2s-token or x-internal-secret)
    const token = request.headers['x-s2s-token'] || request.headers['x-internal-secret'];
    if (typeof token === 'string' && token.trim()) {
      const tokenBuf = Buffer.from(token.trim());
      const secretBuf = Buffer.from(expectedSecret.trim());
      if (tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(tokenBuf, secretBuf)) {
        return true;
      }
    }

    // 2. HMAC-SHA256 signature check (x-sja-app-id, x-sja-timestamp, x-sja-signature)
    const appId = request.headers['x-sja-app-id'];
    const timestampStr = request.headers['x-sja-timestamp'];
    const signature = request.headers['x-sja-signature'];

    if (appId && timestampStr && signature) {
      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      if (isNaN(timestamp) || Math.abs(now - timestamp) > 300000) {
        throw new UnauthorizedException('Request timestamp expired');
      }

      const rawBody = request.rawBody ? request.rawBody.toString('utf-8') : JSON.stringify(request.body || {});
      const expectedPayload = `${timestampStr}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', expectedSecret.trim())
        .update(expectedPayload)
        .digest('hex');

      const sigBuf = Buffer.from(signature);
      const expectedSigBuf = Buffer.from(expectedSignature);
      if (sigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
        return true;
      }
    }

    throw new UnauthorizedException('Unauthorized S2S request: invalid or missing authentication credentials');
  }
}
