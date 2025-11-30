import { Markup } from 'telegraf';

export class PriorityKeyboard {
    static build(ticketId?: string) {
        const prefix = ticketId ? `set_priority:${ticketId}:` : 'select_priority:';
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('🟢 Low', `${prefix}LOW`),
                Markup.button.callback('🟡 Medium', `${prefix}MEDIUM`),
            ],
            [
                Markup.button.callback('🟠 High', `${prefix}HIGH`),
                Markup.button.callback('🔴 Critical', `${prefix}CRITICAL`),
            ],
            [Markup.button.callback('❌ Batal', ticketId ? `ticket_actions:${ticketId}` : 'main_menu')],
        ]);
    }

    static buildWithBack(ticketId: string) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('🟢 Low', `set_priority:${ticketId}:LOW`),
                Markup.button.callback('🟡 Medium', `set_priority:${ticketId}:MEDIUM`),
            ],
            [
                Markup.button.callback('🟠 High', `set_priority:${ticketId}:HIGH`),
                Markup.button.callback('🔴 Urgent', `set_priority:${ticketId}:URGENT`),
            ],
            [
                Markup.button.callback('◀️ Kembali', `ticket_actions:${ticketId}`),
                Markup.button.callback('🏠 Menu', 'main_menu'),
            ],
        ]);
    }

    static getEmoji(priority: string): string {
        const emojiMap: Record<string, string> = {
            'LOW': '🟢',
            'MEDIUM': '🟡',
            'HIGH': '🟠',
            'CRITICAL': '🔴',
            'URGENT': '🔴',
        };
        return emojiMap[priority] || '🟡';
    }
}
