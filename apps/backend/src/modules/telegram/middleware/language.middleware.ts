import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramSession } from '../entities/telegram-session.entity';

/**
 * Language detection middleware (17.4.7)
 * Auto-detects language from user's Telegram settings
 */
@Injectable()
export class LanguageMiddleware {
    constructor(
        @InjectRepository(TelegramSession)
        private readonly sessionRepo: Repository<TelegramSession>,
    ) {}

    /**
     * Detect language from Telegram user data
     */
    detectLanguage(languageCode?: string): 'id' | 'en' {
        if (!languageCode) return 'id';
        
        // Indonesian
        if (languageCode.startsWith('id')) return 'id';
        
        // English variants
        if (languageCode.startsWith('en')) return 'en';
        
        // Default to Indonesian for other languages
        return 'id';
    }

    /**
     * Middleware to set language in context
     */
    middleware() {
        return async (ctx: any, next: () => Promise<void>) => {
            const telegramId = String(ctx.from?.id);
            
            // Try to get from session first
            let session = await this.sessionRepo.findOne({ where: { telegramId } });
            
            if (session) {
                ctx.language = session.language || 'id';
            } else {
                // Auto-detect from Telegram settings
                const detectedLang = this.detectLanguage(ctx.from?.language_code);
                ctx.language = detectedLang;
            }

            return next();
        };
    }

    /**
     * Update user's language preference
     */
    async updateLanguage(telegramId: string, language: 'id' | 'en'): Promise<void> {
        await this.sessionRepo.update({ telegramId }, { language });
    }
}

/**
 * Standalone middleware function
 */
export function languageMiddleware(sessionRepo: Repository<TelegramSession>) {
    return async (ctx: any, next: () => Promise<void>) => {
        const telegramId = String(ctx.from?.id);
        
        try {
            const session = await sessionRepo.findOne({ where: { telegramId } });
            ctx.language = session?.language || detectLanguageFromCode(ctx.from?.language_code);
        } catch {
            ctx.language = 'id';
        }

        return next();
    };
}

function detectLanguageFromCode(code?: string): 'id' | 'en' {
    if (!code) return 'id';
    if (code.startsWith('en')) return 'en';
    return 'id';
}
