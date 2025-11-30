export enum TelegramLanguage {
    ID = 'id',
    EN = 'en',
}

export const SUPPORTED_LANGUAGES = ['id', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export function isValidLanguage(lang: string): lang is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

export function getDefaultLanguage(): TelegramLanguage {
    return TelegramLanguage.ID;
}
