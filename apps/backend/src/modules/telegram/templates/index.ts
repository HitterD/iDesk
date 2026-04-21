import { messagesId, MessagesType } from './messages.id';
import { messagesEn } from './messages.en';

export type Language = 'id' | 'en';

const templates: Record<Language, MessagesType> = {
    id: messagesId,
    en: messagesEn,
};

export function getTemplates(lang: Language | string = 'id'): MessagesType {
    return templates[lang as Language] || templates.id;
}

export function t(key: string, lang: Language | string = 'id'): string {
    const msgs = getTemplates(lang);
    const keys = key.split('.');
    let result: any = msgs;
    
    for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = result[k];
        } else {
            return key;
        }
    }
    
    return typeof result === 'string' ? result : key;
}

export { messagesId, messagesEn, MessagesType };
