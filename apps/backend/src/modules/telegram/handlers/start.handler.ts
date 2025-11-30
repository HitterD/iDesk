import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { getTemplates } from '../templates';
import { MainMenuKeyboard } from '../keyboards';

@Injectable()
export class StartHandler {
    private readonly logger = new Logger(StartHandler.name);

    constructor(private readonly telegramService: TelegramService) {}

    async handle(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        try {
            const session = await this.telegramService.getOrCreateSession(
                String(from.id),
                String(ctx.chat?.id),
                from
            );

            const t = getTemplates(session.language);
            const isLinked = !!session.userId;

            if (isLinked) {
                const stats = await this.telegramService.getUserStats(session.userId!);
                const message = t.welcome.linkedGreeting(
                    session.telegramFirstName || 'User',
                    stats.activeTickets,
                    stats.waitingReply
                );
                await ctx.replyWithHTML(message, MainMenuKeyboard.build(session, stats));
            } else {
                await ctx.replyWithHTML(
                    t.welcome.unlinkedGreeting,
                    MainMenuKeyboard.buildUnlinked(session.language)
                );
            }
        } catch (error) {
            this.logger.error('Error in start handler:', error);
            await ctx.reply('❌ Maaf, terjadi kesalahan. Silakan coba lagi.');
        }
    }

    async handleMainMenu(ctx: Context): Promise<void> {
        await this.handle(ctx);
    }
}
