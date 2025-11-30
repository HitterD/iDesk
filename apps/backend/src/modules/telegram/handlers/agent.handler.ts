import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { getTemplates } from '../templates';
import { AgentActionsKeyboard } from '../keyboards';

@Injectable()
export class AgentHandler {
    private readonly logger = new Logger(AgentHandler.name);

    constructor(private readonly telegramService: TelegramService) {}

    async handleQueue(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun. Gunakan /link terlebih dahulu.');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }

        const t = getTemplates(session.language);
        const unassignedTickets = await this.telegramService.getUnassignedTickets();

        if (unassignedTickets.length === 0) {
            await ctx.replyWithHTML(t.agent.queueEmpty, this.telegramService.getMainMenuKeyboard());
            return;
        }

        await ctx.replyWithHTML(
            t.agent.queueHeader,
            AgentActionsKeyboard.buildQueueList(unassignedTickets)
        );
    }

    async handleAssign(ctx: Context, ticketNumber?: string): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        if (!ticketNumber) {
            await ctx.replyWithHTML(
                `✋ <b>Assign Tiket</b>\n\n` +
                `Cara penggunaan:\n` +
                `<code>/assign [nomor_tiket]</code>\n\n` +
                `<i>Contoh: /assign 271124-IT-0001</i>`
            );
            return;
        }

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun.');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }

        const result = await this.telegramService.assignTicketToAgent(ticketNumber, session.userId);
        
        if (result.success) {
            await ctx.replyWithHTML(
                `✅ <b>Tiket Diambil!</b>\n\n` +
                `Tiket <b>#${ticketNumber}</b> sekarang Anda tangani.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('💬 Balas', `enter_chat:${result.ticketId}`)],
                    [Markup.button.callback('📋 Detail', `view_ticket:${result.ticketId}`)],
                ])
            );
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    async handleAssignById(ctx: Context, ticketId: string): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun.');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Aksi ini hanya untuk Agent/Admin.');
            return;
        }

        const result = await this.telegramService.assignTicketToAgentById(ticketId, session.userId);
        const t = getTemplates(session.language);

        if (result.success) {
            await ctx.replyWithHTML(
                t.agent.assigned(result.ticketNumber!, session.telegramFirstName || 'Agent'),
                AgentActionsKeyboard.buildAssignedTicket(ticketId)
            );
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    async handleResolve(ctx: Context, ticketNumber?: string): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        if (!ticketNumber) {
            await ctx.replyWithHTML(
                `✅ <b>Selesaikan Tiket</b>\n\n` +
                `Cara penggunaan:\n` +
                `<code>/resolve [nomor_tiket]</code>\n\n` +
                `<i>Contoh: /resolve 271124-IT-0001</i>`
            );
            return;
        }

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun.');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }

        const result = await this.telegramService.resolveTicket(ticketNumber, session.userId);

        if (result.success) {
            await ctx.replyWithHTML(
                `✅ <b>Tiket Diselesaikan!</b>\n\n` +
                `Tiket <b>#${ticketNumber}</b> telah ditandai selesai.`,
                this.telegramService.getMainMenuKeyboard()
            );

            if (result.ticket) {
                await this.telegramService.sendSurveyToUser(result.ticket);
            }
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    async handleStats(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun.');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }

        const stats = await this.telegramService.getAgentStats(session.userId);

        await ctx.replyWithHTML(
            `📊 <b>Statistik Hari Ini</b>\n\n` +
            `📋 Tiket Ditangani: <b>${stats.ticketsHandled}</b>\n` +
            `✅ Tiket Selesai: <b>${stats.ticketsResolved}</b>\n` +
            `💬 Pesan Dibalas: <b>${stats.messagesReplied}</b>\n` +
            `⏱️ Rata-rata Response: <b>${stats.avgResponseTime}</b>\n\n` +
            `📈 <b>Antrian:</b>\n` +
            `└ Belum Diassign: <b>${stats.unassignedCount}</b>`,
            this.telegramService.getMainMenuKeyboard()
        );
    }
}
