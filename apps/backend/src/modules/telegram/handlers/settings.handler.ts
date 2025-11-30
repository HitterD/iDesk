import { Injectable, Logger } from '@nestjs/common';
import { Context, Markup } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { getTemplates } from '../templates';
import { SettingsKeyboard } from '../keyboards';

@Injectable()
export class SettingsHandler {
    private readonly logger = new Logger(SettingsHandler.name);

    constructor(private readonly telegramService: TelegramService) {}

    async handleSettings(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session) return;

        const t = getTemplates(session.language);

        await ctx.replyWithHTML(
            `${t.settings.title}\n\n` +
            `${t.settings.notifications(session.notificationsEnabled)}\n` +
            `${t.settings.language(session.language)}`,
            SettingsKeyboard.build(session)
        );
    }

    async handleToggleNotifications(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session) return;

        const newValue = !session.notificationsEnabled;
        await this.telegramService.updateSessionPreferences(String(from.id), {
            notificationsEnabled: newValue
        });

        const updatedSession = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(updatedSession?.language || 'id');

        const message = newValue
            ? '🔔 Notifikasi telah <b>diaktifkan</b>.'
            : '🔕 Notifikasi telah <b>dinonaktifkan</b>.';

        await ctx.replyWithHTML(`✅ ${message}`, SettingsKeyboard.build(updatedSession!));
    }

    async handleChangeLanguage(ctx: Context): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));

        await ctx.replyWithHTML(
            `🌐 <b>Pilih Bahasa / Select Language</b>`,
            SettingsKeyboard.buildLanguageSelection(session?.language)
        );
    }

    async handleSetLanguage(ctx: Context, lang: string): Promise<void> {
        const from = ctx.from;
        if (!from) return;

        await this.telegramService.updateSessionPreferences(String(from.id), {
            language: lang
        });

        const t = getTemplates(lang);
        const langName = lang === 'en' ? 'English' : 'Indonesia';

        await ctx.replyWithHTML(
            `✅ <b>${lang === 'en' ? 'Language changed to' : 'Bahasa diubah ke'} ${langName}</b>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('⚙️ ' + t.btn.settings, 'settings')],
                [Markup.button.callback(t.btn.home, 'main_menu')],
            ])
        );
    }
}
