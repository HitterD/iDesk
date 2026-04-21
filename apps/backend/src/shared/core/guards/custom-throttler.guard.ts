import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Skip throttling for non-HTTP contexts (like Telegram)
        const contextType = context.getType();
        if (contextType !== 'http') {
            return true;
        }

        // Check if request object exists (HTTP context)
        const request = context.switchToHttp().getRequest();
        if (!request || !request.ip) {
            return true;
        }

        return super.canActivate(context);
    }
}
