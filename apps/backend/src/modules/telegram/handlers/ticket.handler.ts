import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { getTemplates } from '../templates';
import { TicketActionsKeyboard, CategoryKeyboard, PriorityKeyboard } from '../keyboards';
import { TelegramState } from '../enums/telegram-state.enum';

@Injectable()
export class TicketHandler {
    private readonly logger = new Logger(TicketHandler.name);

    constructor(private readonly telegramService: TelegramService) {}

    async handleQuickTicket(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
            return;
        }

        const text = ((ctx.message as any)?.text || '')
            .replace(/^\/(tiket|ticket)\s*/i, '')
            .trim();

        if (!text) {
            await ctx.replyWithHTML(
                t.ticket.createTitle,
                Markup.inlineKeyboard([
                    [Markup.button.callback('⚡ Quick (1 pesan)', 'ticket_quick_guide')],
                    [Markup.button.callback('📝 Step-by-step', 'ticket_wizard')],
                    [Markup.button.callback('❌ Batal', 'main_menu')],
                ])
            );
            return;
        }

        try {
            const { category, priority } = this.analyzeTicketText(text);
            
            const ticket = await this.telegramService.createTicket(
                session,
                text.length > 100 ? text.substring(0, 97) + '...' : text,
                text,
                category,
                priority
            );

            await ctx.replyWithHTML(
                t.ticket.quickCreated(ticket.ticketNumber, ticket.title, ticket.category, ticket.priority),
                TicketActionsKeyboard.buildQuickCreated(ticket.id, session.language)
            );

            await this.telegramService.notifyNewTicketToAgents(ticket);
            this.logger.log(`Quick ticket ${ticket.ticketNumber} created via Telegram`);

        } catch (error) {
            this.logger.error('Quick ticket creation failed:', error);
            await ctx.reply(t.errors.serverError);
        }
    }

    async handleList(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked);
            return;
        }

        const tickets = await this.telegramService.getMyTickets(session.userId);

        if (tickets.length === 0) {
            await ctx.replyWithHTML(t.ticket.listEmpty, Markup.inlineKeyboard([
                [Markup.button.callback(t.btn.newTicket, 'new_ticket')],
                [Markup.button.callback(t.btn.home, 'main_menu')],
            ]));
            return;
        }

        await ctx.replyWithHTML(
            t.ticket.listHeader,
            TicketActionsKeyboard.buildTicketList(tickets, session.language)
        );
    }

    async handleWizardStart(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        await this.telegramService.setState(String(from.id), TelegramState.CREATING_TICKET_TITLE);
        await ctx.replyWithHTML(t.ticket.wizardStep1, Markup.inlineKeyboard([
            [Markup.button.callback(t.btn.cancel, 'main_menu')],
        ]));
    }

    analyzeTicketText(text: string): { category: string; priority: string } {
        const lowerText = text.toLowerCase();
        
        let category = 'GENERAL';
        if (/printer|laptop|komputer|mouse|keyboard|monitor|pc/i.test(lowerText)) {
            category = 'HARDWARE';
        } else if (/wifi|internet|network|jaringan|koneksi|vpn/i.test(lowerText)) {
            category = 'NETWORK';
        } else if (/email|outlook|gmail|mail/i.test(lowerText)) {
            category = 'EMAIL';
        } else if (/password|login|akun|account|lupa|reset/i.test(lowerText)) {
            category = 'ACCOUNT';
        } else if (/aplikasi|software|install|update|error|crash/i.test(lowerText)) {
            category = 'SOFTWARE';
        }

        let priority = 'MEDIUM';
        if (/urgent|segera|darurat|critical|penting sekali|emergency/i.test(lowerText)) {
            priority = 'HIGH';
        } else if (/tidak bisa|error|gagal|rusak|mati|down/i.test(lowerText)) {
            priority = 'MEDIUM';
        } else if (/tolong|mohon|bisa|request|minta/i.test(lowerText)) {
            priority = 'LOW';
        }

        return { category, priority };
    }
}
