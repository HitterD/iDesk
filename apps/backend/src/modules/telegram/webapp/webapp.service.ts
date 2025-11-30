import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../telegram.service';
import { WebAppTicketDto } from '../dto/webapp-ticket.dto';
import { TelegramWebAppUser } from '../interfaces/telegram-context.interface';

@Injectable()
export class WebAppService {
    private readonly logger = new Logger(WebAppService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly telegramService: TelegramService,
    ) {}

    /**
     * Validate Telegram Web App init data (17.12 Security)
     */
    validateWebAppData(initData: string): boolean {
        try {
            const urlParams = new URLSearchParams(initData);
            const hash = urlParams.get('hash');
            if (!hash) return false;

            urlParams.delete('hash');
            
            const dataCheckString = Array.from(urlParams.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            
            const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
            if (!botToken) return false;

            const secretKey = createHmac('sha256', 'WebAppData')
                .update(botToken)
                .digest();
            
            const expectedHash = createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');
            
            return hash === expectedHash;
        } catch (error) {
            this.logger.error('Web App data validation failed:', error);
            return false;
        }
    }

    /**
     * Parse user data from init data
     */
    parseUserFromInitData(initData: string): TelegramWebAppUser | null {
        try {
            const urlParams = new URLSearchParams(initData);
            const userJson = urlParams.get('user');
            if (!userJson) return null;

            const user = JSON.parse(userJson);
            return {
                id: String(user.id),
                telegramId: String(user.id),
                telegramChatId: String(user.id), // Same as telegramId for web app
                fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                username: user.username,
            };
        } catch {
            return null;
        }
    }

    /**
     * Create ticket from Web App (17.4.2)
     */
    async createTicketFromWebApp(
        dto: WebAppTicketDto,
        webAppUser: TelegramWebAppUser
    ): Promise<{ success: boolean; ticketId?: string; ticketNumber?: string; message?: string }> {
        // Validate init data
        if (!this.validateWebAppData(dto.initData)) {
            throw new UnauthorizedException('Invalid Web App data');
        }

        // Get linked session
        const session = await this.telegramService.getSession(webAppUser.telegramId);
        if (!session?.userId) {
            return { success: false, message: 'Account not linked' };
        }

        try {
            const ticket = await this.telegramService.createTicket(
                session,
                dto.title,
                dto.description,
                dto.category || 'GENERAL',
                dto.priority || 'MEDIUM'
            );

            // Send confirmation to chat
            await this.telegramService.sendNotification(
                session.chatId,
                `🎫 <b>Tiket dari Web App Dibuat!</b>\n\n` +
                `<b>#${ticket.ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n\n` +
                `Tim support akan segera merespon.`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💬 Chat', callback_data: `enter_chat:${ticket.id}` }],
                            [{ text: '📋 Detail', callback_data: `view_ticket:${ticket.id}` }],
                        ],
                    },
                }
            );

            // Notify agents
            await this.telegramService.notifyNewTicketToAgents(ticket);

            return {
                success: true,
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
            };
        } catch (error: any) {
            this.logger.error('Failed to create ticket from Web App:', error);
            return { success: false, message: error.message };
        }
    }
}
