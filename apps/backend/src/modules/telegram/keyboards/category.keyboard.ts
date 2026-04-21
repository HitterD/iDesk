import { Markup } from 'telegraf';
import { getTemplates } from '../templates';

export class CategoryKeyboard {
    static build(lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.category.hardware, 'select_category:HARDWARE'),
                Markup.button.callback(t.category.software, 'select_category:SOFTWARE'),
            ],
            [
                Markup.button.callback(t.category.network, 'select_category:NETWORK'),
                Markup.button.callback(t.category.account, 'select_category:ACCOUNT'),
            ],
            [
                Markup.button.callback(t.category.email, 'select_category:EMAIL'),
                Markup.button.callback(t.category.general, 'select_category:GENERAL'),
            ],
            [Markup.button.callback(t.btn.cancel, 'main_menu')],
        ]);
    }

    static getCategoryName(category: string, lang: string = 'id'): string {
        const t = getTemplates(lang);
        const categoryMap: Record<string, string> = {
            'HARDWARE': t.category.hardware,
            'SOFTWARE': t.category.software,
            'NETWORK': t.category.network,
            'ACCOUNT': t.category.account,
            'EMAIL': t.category.email,
            'GENERAL': t.category.general,
        };
        return categoryMap[category] || category;
    }
}
