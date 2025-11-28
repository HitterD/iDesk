import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import {
    INotificationChannel,
    ChannelDeliveryPayload,
    DeliveryResult,
    NotificationPriority,
} from '../interfaces/notification-channel.interface';
import { DeliveryChannel } from '../entities/notification-log.entity';

@Injectable()
export class TelegramChannelService implements INotificationChannel {
    private readonly logger = new Logger(TelegramChannelService.name);
    readonly channelType = DeliveryChannel.TELEGRAM;

    constructor(
        @Optional() @InjectBot() private readonly bot: Telegraf<Context> | null,
    ) {}

    async send(payload: ChannelDeliveryPayload): Promise<DeliveryResult> {
        const timestamp = new Date();

        if (!this.bot) {
            return {
                success: false,
                channel: this.channelType,
                error: 'Telegram bot not configured',
                timestamp,
            };
        }

        try {
            // Format message with HTML
            const formattedMessage = this.formatMessage(payload);
            
            // Build inline keyboard if there's a link
            const keyboard = payload.data?.link
                ? Markup.inlineKeyboard([
                    [Markup.button.url('🔗 Lihat Detail', payload.data.link as string)],
                ])
                : undefined;

            const result = await this.bot.telegram.sendMessage(
                payload.recipient,
                formattedMessage,
                {
                    parse_mode: 'HTML',
                    ...keyboard,
                }
            );

            this.logger.log(`Telegram message sent to ${payload.recipient}: ${result.message_id}`);

            return {
                success: true,
                channel: this.channelType,
                messageId: String(result.message_id),
                timestamp,
            };
        } catch (error) {
            this.logger.error(`Failed to send Telegram message to ${payload.recipient}:`, error);

            return {
                success: false,
                channel: this.channelType,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp,
            };
        }
    }

    async validateRecipient(recipient: string): Promise<boolean> {
        if (!this.bot) return false;

        try {
            // Try to get chat info to validate
            await this.bot.telegram.getChat(recipient);
            return true;
        } catch {
            return false;
        }
    }

    isAvailable(): boolean {
        return this.bot !== null;
    }

    private formatMessage(payload: ChannelDeliveryPayload): string {
        const priorityEmoji = this.getPriorityEmoji(payload.priority);
        
        let message = `${priorityEmoji} <b>${payload.title}</b>\n\n`;
        message += payload.body;

        if (payload.data?.ticketId) {
            message += `\n\n🎫 Ticket: #${payload.data.ticketId}`;
        }

        return message;
    }

    private getPriorityEmoji(priority?: NotificationPriority): string {
        switch (priority) {
            case NotificationPriority.URGENT:
                return '🔴';
            case NotificationPriority.HIGH:
                return '🟠';
            case NotificationPriority.NORMAL:
                return '🔵';
            case NotificationPriority.LOW:
                return '⚪';
            default:
                return '📢';
        }
    }
}
