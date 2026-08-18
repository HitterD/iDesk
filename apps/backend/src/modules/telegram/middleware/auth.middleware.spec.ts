import { ExecutionContext } from '@nestjs/common';
import { TelegramWebhookGuard } from './auth.middleware';

describe('TelegramWebhookGuard', () => {
    const context = (headers: Record<string, string>) => ({
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext);

    afterEach(() => {
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
    });

    it('rejects webhook requests when secret configuration is absent', () => {
        expect(() => new TelegramWebhookGuard().canActivate(context({}))).toThrow('Invalid webhook secret');
    });

    it('accepts only the configured webhook secret', () => {
        process.env.TELEGRAM_WEBHOOK_SECRET = 'secret-value';
        const guard = new TelegramWebhookGuard();
        expect(guard.canActivate(context({ 'x-telegram-bot-api-secret-token': 'secret-value' }))).toBe(true);
        expect(() => guard.canActivate(context({ 'x-telegram-bot-api-secret-token': 'wrong-value' }))).toThrow('Invalid webhook secret');
    });

    it('rejects a secret with a different length without comparing buffers', () => {
        process.env.TELEGRAM_WEBHOOK_SECRET = 'secret-value';
        expect(() => new TelegramWebhookGuard().canActivate(
            context({ 'x-telegram-bot-api-secret-token': 'short' }),
        )).toThrow('Invalid webhook secret');
    });
});
