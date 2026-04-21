import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { TelegramChatBridgeService } from '../telegram-chat-bridge.service';
import { getTemplates } from '../templates';
import { TelegramState } from '../enums/telegram-state.enum';

@Injectable()
export class ChatHandler {
    private readonly logger = new Logger(ChatHandler.name);

    constructor(
        private readonly telegramService: TelegramService,
        private readonly chatBridge: TelegramChatBridgeService,
    ) {}

    async handleStartChat(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked);
            return;
        }

        const tickets = await this.chatBridge.getActiveTickets(session.userId);

        if (tickets.length === 0) {
            await ctx.replyWithHTML(t.chat.noActiveTickets, Markup.inlineKeyboard([
                [Markup.button.callback(t.btn.newTicket, 'new_ticket')],
                [Markup.button.callback(t.btn.home, 'main_menu')],
            ]));
            return;
        }

        if (tickets.length === 1) {
            await this.enterChatMode(ctx, tickets[0].id);
            return;
        }

        const buttons = tickets.map(ticket => [
            Markup.button.callback(
                `${this.getStatusEmoji(ticket.status)} #${ticket.ticketNumber}`,
                `enter_chat:${ticket.id}`
            )
        ]);
        buttons.push([
            Markup.button.callback(t.btn.back, 'my_tickets'),
            Markup.button.callback(t.btn.home, 'main_menu'),
        ]);

        await ctx.replyWithHTML(t.chat.selectTicket, Markup.inlineKeyboard(buttons));
    }

    async enterChatMode(ctx: Context, ticketId: string): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        const result = await this.chatBridge.enterChatMode(String(from.id), ticketId);
        
        if (!result.success) {
            await ctx.replyWithHTML(`❌ ${result.message}`);
            return;
        }

        const ticket = await this.chatBridge.getActiveChatTicket(String(from.id));
        if (!ticket) return;

        await ctx.replyWithHTML(
            t.chat.modeActive(ticket.ticketNumber, ticket.title),
            Markup.inlineKeyboard([
                [Markup.button.callback('🛑 Keluar Chat', 'exit_chat')],
                [Markup.button.callback('📋 Lihat Detail', `view_ticket:${ticket.id}`)],
            ])
        );
    }

    async handleEndChat(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        const activeTicket = await this.chatBridge.getActiveChatTicket(String(from.id));

        if (!activeTicket) {
            await ctx.replyWithHTML(t.chat.noActiveChat);
            return;
        }

        await this.chatBridge.exitChatMode(String(from.id));
        await ctx.replyWithHTML(
            t.chat.modeEnded(activeTicket.ticketNumber),
            this.telegramService.getMainMenuKeyboard()
        );
    }

    async handleMessage(ctx: Context, message: string): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const messageId = (ctx.message as any).message_id;
        const result = await this.chatBridge.forwardToTicket(
            String(from.id),
            String(ctx.chat?.id),
            message,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(`❌ ${result.message}`);
            if (result.message.includes('ditutup') || result.message.includes('tidak ditemukan')) {
                await this.chatBridge.exitChatMode(String(from.id));
            }
        }
    }

    private getStatusEmoji(status: string): string {
        const emojiMap: Record<string, string> = {
            'TODO': '🔵',
            'IN_PROGRESS': '🟡',
            'WAITING_VENDOR': '🟠',
            'RESOLVED': '🟢',
            'CANCELLED': '🔴',
        };
        return emojiMap[status] || '⚪';
    }
}
