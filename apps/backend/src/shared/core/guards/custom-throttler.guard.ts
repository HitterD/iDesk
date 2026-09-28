import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getTrustedClientIp } from '../../security/client-ip';

const ACCESS_TOKEN_COOKIE = 'access_token';
const AUTH_PATH_SEGMENT = '/auth/';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    private readonly tokenVerifier = new JwtService();

    /**
     * Authenticated requests are tracked per user so that many users behind one
     * proxy/NAT IP don't share (and exhaust) a single bucket. Auth endpoints and
     * anonymous requests stay IP-scoped.
     */
    protected async getTracker(request: Record<string, any>): Promise<string> {
        const path = String(request.route?.path || request.path || '');
        const userId = path.includes(AUTH_PATH_SEGMENT) ? null : this.getAuthenticatedUserId(request);
        return userId ? `user:${userId}` : getTrustedClientIp(request as any);
    }

    protected generateKey(context: ExecutionContext, tracker: string, name: string): string {
        const request = context.switchToHttp().getRequest<Record<string, any>>();
        const path = String(request.route?.path || request.path || '');
        const identifier = typeof request.body?.email === 'string'
            ? request.body.email.trim().toLowerCase()
            : 'unknown';
        const accountScope = path.includes(AUTH_PATH_SEGMENT) ? `:${identifier}` : '';
        return `${context.getClass().name}-${context.getHandler().name}-${name}-${tracker}-${path}${accountScope}`;
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (context.getType() !== 'http') return true;
        const request = context.switchToHttp().getRequest();
        if (!request) return true;
        return super.canActivate(context);
    }

    // Signature is verified so a forged token cannot be used to rotate buckets.
    private getAuthenticatedUserId(request: Record<string, any>): string | null {
        const secret = process.env.JWT_SECRET;
        const token = this.extractAccessToken(request);
        if (!secret || !token) return null;
        try {
            const payload = this.tokenVerifier.verify<{ sub?: unknown; type?: unknown }>(token, { secret });
            return payload.type === 'access' && typeof payload.sub === 'string' ? payload.sub : null;
        } catch {
            return null; // invalid/expired token → fall back to IP tracking
        }
    }

    private extractAccessToken(request: Record<string, any>): string | null {
        const cookieToken = request.cookies?.[ACCESS_TOKEN_COOKIE];
        if (typeof cookieToken === 'string' && cookieToken) return cookieToken;
        const authorization = request.headers?.authorization;
        if (typeof authorization !== 'string') return null;
        const [type, headerToken] = authorization.split(' ');
        return type === 'Bearer' && headerToken ? headerToken : null;
    }
}

/* ponytail: limits remain endpoint-owned by @Throttle; add separate account/IP
   buckets only after measured false-positive data and a shared throttler store. */
