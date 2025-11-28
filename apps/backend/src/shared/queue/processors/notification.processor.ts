import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../modules/notifications/entities/notification.entity';
import { NotificationLog, DeliveryChannel, DeliveryStatus } from '../../../modules/notifications/entities/notification-log.entity';

export interface NotificationJobData {
    notificationId: string;
    userId: string;
    channel: DeliveryChannel;
    payload: {
        type: string;
        title: string;
        message: string;
        ticketId?: string;
        link?: string;
        metadata?: Record<string, any>;
    };
    recipient: {
        email?: string;
        telegramChatId?: string;
        pushTokens?: string[];
    };
}

@Processor('notifications')
export class NotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(
        @InjectRepository(Notification)
        private notificationRepo: Repository<Notification>,
        @InjectRepository(NotificationLog)
        private logRepo: Repository<NotificationLog>,
    ) {}

    @Process('send-notification')
    async handleSendNotification(job: Job<NotificationJobData>) {
        const { notificationId, userId, channel, payload, recipient } = job.data;
        
        this.logger.debug(`Processing notification job ${job.id} for channel ${channel}`);

        const log = this.logRepo.create({
            notificationId,
            channel,
            status: DeliveryStatus.PENDING,
            recipient: recipient.email || recipient.telegramChatId || recipient.pushTokens?.[0] || '',
        });
        await this.logRepo.save(log);

        try {
            // The actual delivery is handled by channel services
            // This processor just orchestrates and logs
            
            log.status = DeliveryStatus.SENT;
            log.sentAt = new Date();
            await this.logRepo.save(log);

            return { success: true, logId: log.id };
        } catch (error: any) {
            log.status = DeliveryStatus.FAILED;
            log.errorMessage = error.message;
            await this.logRepo.save(log);
            
            throw error; // Rethrow for retry mechanism
        }
    }

    @Process('send-digest')
    async handleSendDigest(job: Job<{ userId: string; notifications: any[] }>) {
        const { userId, notifications } = job.data;
        
        this.logger.debug(`Processing digest job for user ${userId} with ${notifications.length} notifications`);
        
        // Digest sending logic here
        return { success: true, count: notifications.length };
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(
            `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
            error.stack,
        );
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        this.logger.debug(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
    }
}
