import { Injectable, Logger } from '@nestjs/common';
import { IChatPlatform, InboundMessage } from '../../domain/ports/chat-platform.interface';

@Injectable()
export class TelegramAdapter implements IChatPlatform {
    private readonly logger = new Logger(TelegramAdapter.name);

    async sendMessage(chatId: string, text: string, options?: any): Promise<void> {
        this.logger.log(`[Telegram] Sending to ${chatId}: ${text} | Options: ${JSON.stringify(options)}`);
        // In real implementation: await this.bot.telegram.sendMessage(chatId, text, options);
        return Promise.resolve();
    }

    parseIncomingWebhook(payload: any): InboundMessage {
        // Handle Callback Query (Button Click)
        if (payload.callback_query) {
            const { id, from, message, data } = payload.callback_query;
            return {
                chatId: from.id.toString(),
                text: data, // Treat action as text for simplicity or handle separately
                senderName: `${from.first_name} ${from.last_name || ''}`.trim(),
                action: data,
                messageId: message.message_id,
            };
        }

        // Handle Text Message
        if (!payload || !payload.message || !payload.message.from) {
            // Ignore other updates for now
            this.logger.warn('Invalid or unsupported Telegram payload', payload);
            // Return a dummy message to avoid crashing, or throw specific error to be caught
            throw new Error('Invalid Telegram payload');
        }

        const { id, first_name, last_name } = payload.message.from;
        const text = payload.message.text || '';

        return {
            chatId: id.toString(),
            text,
            senderName: `${first_name} ${last_name || ''}`.trim(),
        };
    }
}
