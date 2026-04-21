import { Markup } from 'telegraf';
import { TelegramSession } from '../entities/telegram-session.entity';
import { getTemplates } from '../templates';

export interface UserStats {
    activeTickets: number;
    waitingReply: number;
}

export class MainMenuKeyboard {
    static build(session: TelegramSession, _stats?: UserStats) {
        const t = getTemplates(session.language);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.btn.newTicket, 'new_ticket'),
                Markup.button.callback(t.btn.myTickets, 'my_tickets'),
            ],
            [
                Markup.button.callback(t.btn.chat, 'start_chat'),
                Markup.button.callback(t.btn.searchKb, 'search_kb'),
            ],
            [
                Markup.button.callback(t.btn.settings, 'settings'),
                Markup.button.callback(t.btn.help, 'help'),
            ],
        ]);
    }

    static buildUnlinked(lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [Markup.button.callback(`${t.btn.link} Masukkan Kode`, 'enter_code')],
            [Markup.button.callback(t.btn.help, 'help')],
        ]);
    }

    static buildBackHome(backAction: string = 'main_menu', lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.btn.back, backAction),
                Markup.button.callback(t.btn.home, 'main_menu'),
            ],
        ]);
    }
}
