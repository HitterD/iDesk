import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getTrustedClientIp } from '../../security/client-ip';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(request: Record<string, any>): Promise<string> {
        return getTrustedClientIp(request as any);
    }

    protected generateKey(context: ExecutionContext, tracker: string, name: string): string {
        const request = context.switchToHttp().getRequest<Record<string, any>>();
        const path = String(request.route?.path || request.path || '');
        const identifier = typeof request.body?.email === 'string'
            ? request.body.email.trim().toLowerCase()
            : 'unknown';
        const accountScope = path.includes('/auth/') ? `:${identifier}` : '';
        return `${context.getClass().name}-${context.getHandler().name}-${name}-${tracker}-${path}${accountScope}`;
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (context.getType() !== 'http') return true;
        const request = context.switchToHttp().getRequest();
        if (!request) return true;
        return super.canActivate(context);
    }
}

/* ponytail: limits remain endpoint-owned by @Throttle; add separate account/IP
   buckets only after measured false-positive data and a shared throttler store. */
