import { Markup } from 'telegraf';

export class AgentActionsKeyboard {
    static buildNewTicketNotification(ticketId: string) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('✋ Ambil', `assign_ticket:${ticketId}`),
                Markup.button.callback('👀 Detail', `view_ticket:${ticketId}`),
            ],
            [Markup.button.callback('⏭️ Skip', 'main_menu')],
        ]);
    }

    static buildAssignedTicket(ticketId: string) {
        return Markup.inlineKeyboard([
            [Markup.button.callback('💬 Balas', `enter_chat:${ticketId}`)],
            [Markup.button.callback('📋 Detail', `view_ticket:${ticketId}`)],
        ]);
    }

    static buildQuickReplies() {
        const templates = [
            { text: 'Terima kasih sudah menghubungi...', key: '0' },
            { text: 'Mohon informasikan detail...', key: '1' },
            { text: 'Sedang dalam proses perbaikan...', key: '2' },
            { text: 'Masalah sudah teratasi...', key: '3' },
            { text: 'Ada kendala lain?', key: '4' },
        ];

        const buttons = templates.map(t => [
            Markup.button.callback(t.text, `send_quick:${t.key}`)
        ]);

        buttons.push([Markup.button.callback('❌ Batal', 'main_menu')]);

        return Markup.inlineKeyboard(buttons);
    }

    static buildQueueList(tickets: Array<{ id: string; ticketNumber: string; title: string; priority: string }>) {
        const priorityEmoji: Record<string, string> = {
            'LOW': '🟢',
            'MEDIUM': '🟡',
            'HIGH': '🟠',
            'CRITICAL': '🔴',
        };

        const buttons = tickets.map(ticket => [
            Markup.button.callback(
                `${priorityEmoji[ticket.priority] || '🟡'} #${ticket.ticketNumber}`,
                `ticket_actions:${ticket.id}`
            )
        ]);

        buttons.push([Markup.button.callback('🏠 Menu', 'main_menu')]);

        return Markup.inlineKeyboard(buttons);
    }
}
