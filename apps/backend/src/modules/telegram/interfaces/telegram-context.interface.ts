import { Context } from 'telegraf';
import { TelegramSession } from '../entities/telegram-session.entity';
import { SupportedLanguage } from '../enums/telegram-language.enum';

export interface TelegramContext extends Context {
    session?: TelegramSession;
    language?: SupportedLanguage;
    userId?: string;
    isLinked?: boolean;
    isAgent?: boolean;
}

export interface TelegramWebAppUser {
    id: string;
    telegramId: string;
    telegramChatId: string;
    fullName?: string;
    username?: string;
}

export interface TelegramCallbackData {
    action: string;
    payload?: string;
    ticketId?: string;
    priority?: string;
    category?: string;
    rating?: number;
    page?: number;
}

export interface BotResponse {
    success: boolean;
    message?: string;
    data?: any;
}

export interface TicketCreationData {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    attachments?: string[];
}
