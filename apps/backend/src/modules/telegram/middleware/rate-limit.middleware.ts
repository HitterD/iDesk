import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

/**
 * Rate limiting guard for Telegram bot (17.12)
 * Limits: 20 requests per minute per user
 */
@Injectable()
export class TelegramRateLimitGuard implements CanActivate {
    private readonly logger = new Logger(TelegramRateLimitGuard.name);
    private readonly limits = new Map<string, RateLimitEntry>();
    private readonly maxRequests = 20;
    private readonly windowMs = 60 * 1000; // 1 minute

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const update = request.body;
        
        const userId = this.extractUserId(update);
        if (!userId) return true;

        const now = Date.now();
        const entry = this.limits.get(userId);

        if (!entry || now > entry.resetTime) {
            this.limits.set(userId, { count: 1, resetTime: now + this.windowMs });
            return true;
        }

        if (entry.count >= this.maxRequests) {
            this.logger.warn(`Rate limit exceeded for user ${userId}`);
            return false;
        }

        entry.count++;
        return true;
    }

    private extractUserId(update: any): string | null {
        if (update?.message?.from?.id) return String(update.message.from.id);
        if (update?.callback_query?.from?.id) return String(update.callback_query.from.id);
        if (update?.inline_query?.from?.id) return String(update.inline_query.from.id);
        return null;
    }

    // Cleanup old entries periodically
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.limits.entries()) {
            if (now > entry.resetTime) {
                this.limits.delete(key);
            }
        }
    }
}

/**
 * Telegraf middleware for rate limiting
 */
export function rateLimitMiddleware(maxRequests = 20, windowMs = 60000) {
    const limits = new Map<string, RateLimitEntry>();

    return async (ctx: any, next: () => Promise<void>) => {
        const userId = String(ctx.from?.id);
        if (!userId) return next();

        const now = Date.now();
        const entry = limits.get(userId);

        if (!entry || now > entry.resetTime) {
            limits.set(userId, { count: 1, resetTime: now + windowMs });
            return next();
        }

        if (entry.count >= maxRequests) {
            await ctx.reply('⚠️ Terlalu banyak permintaan. Silakan tunggu sebentar.');
            return;
        }

        entry.count++;
        return next();
    };
}
