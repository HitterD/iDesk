import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';

/**
 * Guard for Telegram Webhook verification (17.12)
 */
@Injectable()
export class TelegramWebhookGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const secretToken = request.headers['x-telegram-bot-api-secret-token'];
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

        if (webhookSecret && secretToken !== webhookSecret) {
            throw new UnauthorizedException('Invalid webhook secret');
        }

        return true;
    }
}

/**
 * Guard for Telegram Web App data validation (17.12)
 */
@Injectable()
export class TelegramWebAppGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const initData = request.body?.initData || request.headers['x-telegram-init-data'];

        if (!initData) {
            throw new UnauthorizedException('Missing Telegram init data');
        }

        const isValid = this.validateWebAppData(initData);
        if (!isValid) {
            throw new UnauthorizedException('Invalid Telegram Web App data');
        }

        return true;
    }

    private validateWebAppData(initData: string): boolean {
        try {
            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get('hash');
            if (!hash) return false;

            urlParams.delete('hash');
            
            const dataCheckString = Array.from(urlParams.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) return false;

            const secretKey = createHmac('sha256', 'WebAppData')
                .update(botToken)
                .digest();
            
            const expectedHash = createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');
            
            return hash === expectedHash;
        } catch {
            return false;
        }
    }
}

/**
 * Middleware to check if user is linked
 */
export function requireLinkedAccount() {
    return async (ctx: any, next: () => Promise<void>) => {
        const session = ctx.session;
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun. Gunakan /link terlebih dahulu.');
            return;
        }
        return next();
    };
}

/**
 * Middleware to check if user is agent/admin
 */
export function requireAgent() {
    return async (ctx: any, next: () => Promise<void>) => {
        const session = ctx.session;
        const user = session?.user;
        
        if (!user || (user.role !== 'AGENT' && user.role !== 'ADMIN')) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }
        return next();
    };
}
