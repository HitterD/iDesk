import { Module, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule, InjectBot } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { TelegramSession } from './entities/telegram-session.entity';
import { TelegramService } from './telegram.service';
import { TelegramChatBridgeService } from './telegram-chat-bridge.service';
import { TelegramUpdate } from './telegram.update';
import { TelegramController } from './telegram.controller';
import { WebAppController } from './webapp/webapp.controller';
import { WebAppService } from './webapp/webapp.service';
// Handlers (17.8)
import { StartHandler } from './handlers/start.handler';
import { TicketHandler } from './handlers/ticket.handler';
import { ChatHandler } from './handlers/chat.handler';
import { SettingsHandler } from './handlers/settings.handler';
import { AgentHandler } from './handlers/agent.handler';
import { InlineHandler } from './handlers/inline.handler';
import { User } from '../users/entities/user.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { TicketingModule } from '../ticketing/ticketing.module';
import { AppCacheModule } from '../../shared/core/cache';

/**
 * Telegram Bot Configuration
 * 
 * Environment Variables:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_USE_WEBHOOK: Set to 'true' to use webhook mode (production)
 * - TELEGRAM_WEBHOOK_DOMAIN: Your domain (e.g., https://api.yourapp.com)
 * - TELEGRAM_WEBHOOK_PATH: Path for webhook (default: /telegram/webhook)
 * 
 * Polling Mode (Development):
 *   TELEGRAM_USE_WEBHOOK=false or not set
 *   Bot will use long polling to receive updates
 * 
 * Webhook Mode (Production):
 *   TELEGRAM_USE_WEBHOOK=true
 *   TELEGRAM_WEBHOOK_DOMAIN=https://api.yourapp.com
 *   Bot will receive updates via HTTP webhook
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([TelegramSession, User, Ticket, TicketMessage]),
        forwardRef(() => TicketingModule),
        AppCacheModule, // For CacheService (link codes storage)
        TelegrafModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
                const useWebhook = configService.get<string>('TELEGRAM_USE_WEBHOOK') === 'true';
                const webhookDomain = configService.get<string>('TELEGRAM_WEBHOOK_DOMAIN');
                const webhookPath = configService.get<string>('TELEGRAM_WEBHOOK_PATH', '/telegram/webhook');
                const logger = new Logger('TelegramModule');
                
                if (!token) {
                    logger.warn('TELEGRAM_BOT_TOKEN not set. Bot will not start.');
                    return { token: 'dummy-token-bot-disabled' };
                }
                
                logger.log(`Telegram Bot Token: ${token.substring(0, 10)}...`);
                logger.log(`Mode: ${useWebhook ? 'Webhook' : 'Polling'}`);
                
                if (useWebhook && webhookDomain) {
                    // Webhook mode for production
                    const webhookUrl = `${webhookDomain}${webhookPath}`;
                    logger.log(`Setting webhook to: ${webhookUrl}`);
                    
                    const { Telegraf } = require('telegraf');
                    const tempBot = new Telegraf(token);
                    try {
                        await tempBot.telegram.setWebhook(webhookUrl);
                        logger.log('✅ Webhook configured successfully');
                    } catch (e: any) {
                        logger.error('Failed to set webhook:', e.message);
                    }
                    
                    return {
                        token,
                        launchOptions: false, // Don't launch polling
                    };
                } else {
                    // Polling mode for development
                    const { Telegraf } = require('telegraf');
                    const tempBot = new Telegraf(token);
                    try {
                        await tempBot.telegram.deleteWebhook({ drop_pending_updates: true });
                        logger.log('Webhook cleared, waiting 3 seconds...');
                        await new Promise(r => setTimeout(r, 3000));
                    } catch (e) {
                        logger.warn('Could not clear webhook');
                    }
                    
                    return { 
                        token,
                        launchOptions: {
                            dropPendingUpdates: true,
                        },
                    };
                }
            },
        }),
    ],
    providers: [
        TelegramService, 
        TelegramChatBridgeService, 
        TelegramUpdate, 
        WebAppService,
        // Handlers (17.8)
        StartHandler,
        TicketHandler,
        ChatHandler,
        SettingsHandler,
        AgentHandler,
        InlineHandler,
    ],
    controllers: [TelegramController, WebAppController],
    exports: [
        TelegramService, 
        TelegramChatBridgeService, 
        WebAppService,
        // Export handlers for external use
        StartHandler,
        TicketHandler,
        ChatHandler,
        SettingsHandler,
        AgentHandler,
        InlineHandler,
    ],
})
export class TelegramModule implements OnModuleInit {
    private readonly logger = new Logger('TelegramModule');
    
    constructor(
        @InjectBot() private readonly bot: Telegraf<Context>,
        private readonly configService: ConfigService,
    ) {}
    
    async onModuleInit() {
        try {
            const me = await this.bot.telegram.getMe();
            const useWebhook = this.configService.get<string>('TELEGRAM_USE_WEBHOOK') === 'true';
            this.logger.log(`✅ Bot ready: @${me.username} (${useWebhook ? 'Webhook' : 'Polling'} mode)`);
        } catch (error: any) {
            this.logger.error('Bot connection failed:', error.message);
        }
    }
}
