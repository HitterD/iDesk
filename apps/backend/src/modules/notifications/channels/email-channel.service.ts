import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import {
    INotificationChannel,
    ChannelDeliveryPayload,
    DeliveryResult,
} from '../interfaces/notification-channel.interface';
import { DeliveryChannel } from '../entities/notification-log.entity';

@Injectable()
export class EmailChannelService implements INotificationChannel {
    private readonly logger = new Logger(EmailChannelService.name);
    readonly channelType = DeliveryChannel.EMAIL;

    constructor(private readonly mailerService: MailerService) {}

    async send(payload: ChannelDeliveryPayload): Promise<DeliveryResult> {
        const timestamp = new Date();

        try {
            const result = await this.mailerService.sendMail({
                to: payload.recipient,
                subject: payload.title,
                template: 'notification', // Uses templates/notification.hbs
                context: {
                    title: payload.title,
                    message: payload.body,
                    link: payload.data?.link,
                    ticketId: payload.data?.ticketId,
                    notificationId: payload.notificationId,
                },
            });

            this.logger.log(`Email sent to ${payload.recipient}: ${result.messageId}`);

            return {
                success: true,
                channel: this.channelType,
                messageId: result.messageId,
                timestamp,
            };
        } catch (error) {
            this.logger.error(`Failed to send email to ${payload.recipient}:`, error);

            return {
                success: false,
                channel: this.channelType,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp,
            };
        }
    }

    async validateRecipient(recipient: string): Promise<boolean> {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(recipient);
    }

    isAvailable(): boolean {
        // Check if mailer is configured
        return true; // MailerModule is always available if loaded
    }
}
