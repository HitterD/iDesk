import { Markup } from 'telegraf';
import { getTemplates } from '../templates';

export class TicketActionsKeyboard {
    static build(ticketId: string, lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.btn.chat, `enter_chat:${ticketId}`),
                Markup.button.callback('📋 Detail', `view_ticket:${ticketId}`),
            ],
            [
                Markup.button.callback('⚡ Prioritas', `change_priority:${ticketId}`),
            ],
            [
                Markup.button.callback(t.btn.back, 'my_tickets'),
                Markup.button.callback(t.btn.home, 'main_menu'),
            ],
        ]);
    }

    static buildQuickCreated(ticketId: string, lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.btn.chat, `enter_chat:${ticketId}`),
                Markup.button.callback('⚡ Ubah Prioritas', `change_priority:${ticketId}`),
                Markup.button.callback('📋 Detail', `view_ticket:${ticketId}`),
            ],
        ]);
    }

    static buildAfterCreated(ticketId: string, lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.btn.chat, `enter_chat:${ticketId}`),
                Markup.button.callback('📋 Detail', `view_ticket:${ticketId}`),
            ],
            [Markup.button.callback(t.btn.home, 'main_menu')],
        ]);
    }

    static buildChatMode(ticketId: string, lang: string = 'id') {
        return Markup.inlineKeyboard([
            [Markup.button.callback('🛑 Keluar Chat', 'exit_chat')],
            [Markup.button.callback('📋 Lihat Detail', `view_ticket:${ticketId}`)],
        ]);
    }

    static buildTicketList(tickets: Array<{ id: string; ticketNumber: string; title: string; status: string }>, lang: string = 'id') {
        const t = getTemplates(lang);
        const statusEmoji: Record<string, string> = {
            'TODO': '🔵',
            'IN_PROGRESS': '🟡',
            'WAITING_VENDOR': '🟠',
            'RESOLVED': '🟢',
            'CLOSED': '⚫',
            'CANCELLED': '🔴',
        };
        
        const buttons = tickets.map(ticket => [
            Markup.button.callback(
                `${statusEmoji[ticket.status] || '⚪'} #${ticket.ticketNumber} - ${ticket.title.substring(0, 20)}...`,
                `ticket_actions:${ticket.id}`
            )
        ]);

        buttons.push([
            Markup.button.callback(t.btn.newTicket, 'new_ticket'),
            Markup.button.callback(t.btn.home, 'main_menu'),
        ]);

        return Markup.inlineKeyboard(buttons);
    }
}
