import { Markup } from 'telegraf';
import { TelegramSession } from '../entities/telegram-session.entity';
import { getTemplates } from '../templates';

export class SettingsKeyboard {
    static build(session: TelegramSession) {
        const t = getTemplates(session.language);
        const notifText = session.notificationsEnabled 
            ? '🔕 Matikan Notifikasi' 
            : '🔔 Aktifkan Notifikasi';
        
        return Markup.inlineKeyboard([
            [Markup.button.callback(notifText, 'toggle_notifications')],
            [Markup.button.callback('🌐 Ganti Bahasa', 'change_language')],
            [Markup.button.callback(t.btn.home, 'main_menu')],
        ]);
    }

    static buildLanguageSelection(currentLang: string = 'id') {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(
                    currentLang === 'id' ? '✅ Indonesia' : 'Indonesia',
                    'set_language:id'
                ),
            ],
            [
                Markup.button.callback(
                    currentLang === 'en' ? '✅ English' : 'English',
                    'set_language:en'
                ),
            ],
            [Markup.button.callback('◀️ Kembali', 'settings')],
        ]);
    }
}
