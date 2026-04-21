import { Injectable, Logger } from '@nestjs/common';

export interface TelegramAnalytics {
    dailyActiveUsers: number;
    ticketsCreatedViaBot: number;
    averageResponseTime: number;
    commandUsage: Record<string, number>;
    errorRate: number;
    satisfactionScore: number;
}

export interface InteractionLog {
    source: string;
    action: string;
    userId?: string;
    telegramId: string;
    metadata?: any;
    timestamp: Date;
    duration?: number;
    success: boolean;
    error?: string;
}

/**
 * Logging middleware for Telegram bot (17.11)
 */
@Injectable()
export class LoggingMiddleware {
    private readonly logger = new Logger('TelegramBot');
    private readonly commandUsage = new Map<string, number>();
    private readonly interactions: InteractionLog[] = [];
    private readonly maxInteractionLogs = 10000;

    /**
     * Telegraf middleware for logging all interactions
     */
    middleware() {
        return async (ctx: any, next: () => Promise<void>) => {
            const startTime = Date.now();
            const telegramId = String(ctx.from?.id || 'unknown');
            let action = 'unknown';
            let success = true;
            let error: string | undefined;

            // Determine action type
            if (ctx.message?.text) {
                if (ctx.message.text.startsWith('/')) {
                    action = `command:${ctx.message.text.split(' ')[0]}`;
                    this.incrementCommandUsage(ctx.message.text.split(' ')[0]);
                } else {
                    action = 'text_message';
                }
            } else if (ctx.callbackQuery) {
                action = `callback:${ctx.callbackQuery.data?.split(':')[0] || 'unknown'}`;
            } else if (ctx.inlineQuery) {
                action = 'inline_query';
            } else if (ctx.message?.photo) {
                action = 'photo';
            } else if (ctx.message?.document) {
                action = 'document';
            } else if (ctx.message?.voice) {
                action = 'voice';
            }

            try {
                await next();
            } catch (err: any) {
                success = false;
                error = err.message;
                this.logger.error(`Error in ${action}:`, err);
                throw err;
            } finally {
                const duration = Date.now() - startTime;
                
                this.logInteraction({
                    source: 'TELEGRAM_BOT',
                    action,
                    telegramId,
                    userId: ctx.session?.userId,
                    timestamp: new Date(),
                    duration,
                    success,
                    error,
                });

                this.logger.debug(`[${telegramId}] ${action} - ${duration}ms - ${success ? 'OK' : 'FAIL'}`);
            }
        };
    }

    /**
     * Log an interaction
     */
    logInteraction(log: InteractionLog): void {
        this.interactions.push(log);
        
        // Keep only recent logs
        if (this.interactions.length > this.maxInteractionLogs) {
            this.interactions.shift();
        }
    }

    /**
     * Increment command usage counter
     */
    private incrementCommandUsage(command: string): void {
        const current = this.commandUsage.get(command) || 0;
        this.commandUsage.set(command, current + 1);
    }

    /**
     * Get analytics data (17.11)
     */
    getAnalytics(): Partial<TelegramAnalytics> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayLogs = this.interactions.filter(
            log => log.timestamp >= today
        );

        const uniqueUsers = new Set(todayLogs.map(log => log.telegramId));
        const ticketCreations = todayLogs.filter(
            log => log.action.includes('new_ticket') || log.action.includes('/tiket')
        );
        const errors = todayLogs.filter(log => !log.success);

        return {
            dailyActiveUsers: uniqueUsers.size,
            ticketsCreatedViaBot: ticketCreations.length,
            commandUsage: Object.fromEntries(this.commandUsage),
            errorRate: todayLogs.length > 0 ? errors.length / todayLogs.length : 0,
        };
    }

    /**
     * Get recent interactions for debugging
     */
    getRecentInteractions(limit = 100): InteractionLog[] {
        return this.interactions.slice(-limit);
    }

    /**
     * Clear old logs
     */
    cleanup(olderThanDays = 7): void {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);

        const initialLength = this.interactions.length;
        const filtered = this.interactions.filter(log => log.timestamp >= cutoff);
        this.interactions.length = 0;
        this.interactions.push(...filtered);

        this.logger.log(`Cleaned up ${initialLength - filtered.length} old interaction logs`);
    }
}

/**
 * Standalone logging function
 */
export function createLoggingMiddleware() {
    const logger = new Logger('TelegramBot');

    return async (ctx: any, next: () => Promise<void>) => {
        const startTime = Date.now();
        const telegramId = ctx.from?.id || 'unknown';
        
        try {
            await next();
            const duration = Date.now() - startTime;
            logger.debug(`[${telegramId}] Request completed in ${duration}ms`);
        } catch (err: any) {
            const duration = Date.now() - startTime;
            logger.error(`[${telegramId}] Error after ${duration}ms: ${err.message}`);
            throw err;
        }
    };
}
