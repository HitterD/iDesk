import { Markup } from 'telegraf';

/**
 * Keyboard builder utilities for Telegram bot
 */
export class KeyboardBuilder {
    /**
     * Create inline keyboard from array of buttons
     */
    static inline(buttons: Array<Array<{ text: string; callback: string } | { text: string; url: string }>>) {
        const keyboard = buttons.map(row =>
            row.map(btn => {
                if ('callback' in btn) {
                    return Markup.button.callback(btn.text, btn.callback);
                } else {
                    return Markup.button.url(btn.text, btn.url);
                }
            })
        );
        return Markup.inlineKeyboard(keyboard);
    }

    /**
     * Create reply keyboard
     */
    static reply(buttons: string[][], options?: { oneTime?: boolean; resize?: boolean }) {
        const keyboard = Markup.keyboard(buttons);
        if (options?.oneTime) keyboard.oneTime();
        if (options?.resize !== false) keyboard.resize();
        return keyboard;
    }

    /**
     * Remove keyboard
     */
    static remove() {
        return Markup.removeKeyboard();
    }

    /**
     * Create pagination keyboard
     */
    static pagination(
        currentPage: number,
        totalPages: number,
        callbackPrefix: string
    ) {
        const buttons: any[] = [];
        
        if (currentPage > 1) {
            buttons.push(Markup.button.callback('◀️', `${callbackPrefix}:${currentPage - 1}`));
        }
        
        buttons.push(Markup.button.callback(`${currentPage}/${totalPages}`, 'noop'));
        
        if (currentPage < totalPages) {
            buttons.push(Markup.button.callback('▶️', `${callbackPrefix}:${currentPage + 1}`));
        }

        return Markup.inlineKeyboard([buttons]);
    }

    /**
     * Create confirmation keyboard
     */
    static confirmation(
        confirmCallback: string,
        cancelCallback: string = 'cancel',
        lang: string = 'id'
    ) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(lang === 'en' ? '✅ Confirm' : '✅ Konfirmasi', confirmCallback),
                Markup.button.callback(lang === 'en' ? '❌ Cancel' : '❌ Batal', cancelCallback),
            ],
        ]);
    }

    /**
     * Create back and home buttons
     */
    static backHome(backCallback: string = 'main_menu', lang: string = 'id') {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(lang === 'en' ? '◀️ Back' : '◀️ Kembali', backCallback),
                Markup.button.callback(lang === 'en' ? '🏠 Menu' : '🏠 Menu', 'main_menu'),
            ],
        ]);
    }

    /**
     * Create yes/no keyboard
     */
    static yesNo(yesCallback: string, noCallback: string, lang: string = 'id') {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(lang === 'en' ? '✅ Yes' : '✅ Ya', yesCallback),
                Markup.button.callback(lang === 'en' ? '❌ No' : '❌ Tidak', noCallback),
            ],
        ]);
    }

    /**
     * Create rating keyboard (1-5 stars)
     */
    static rating(callbackPrefix: string) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('⭐', `${callbackPrefix}:1`),
                Markup.button.callback('⭐⭐', `${callbackPrefix}:2`),
                Markup.button.callback('⭐⭐⭐', `${callbackPrefix}:3`),
                Markup.button.callback('⭐⭐⭐⭐', `${callbackPrefix}:4`),
                Markup.button.callback('⭐⭐⭐⭐⭐', `${callbackPrefix}:5`),
            ],
        ]);
    }
}
