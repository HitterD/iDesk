import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';
import { getCategoryFromType } from './utils/category-mapper';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';

@Injectable()
export class NotificationService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        private readonly eventsGateway: EventsGateway,
    ) {}

    async create(data: {
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        ticketId?: string;
        referenceId?: string;
        link?: string;
        category?: NotificationCategory;
    }): Promise<Notification> {
        // Auto-determine category from type if not provided
        const category = data.category || getCategoryFromType(data.type);
        const notification = this.notificationRepo.create({
            ...data,
            category,
        });
        const saved = await this.notificationRepo.save(notification);

        // Emit real-time notification via WebSocket
        this.eventsGateway.server.emit(`notification:${data.userId}`, {
            id: saved.id,
            type: saved.type,
            category: saved.category,
            title: saved.title,
            message: saved.message,
            ticketId: saved.ticketId,
            referenceId: saved.referenceId,
            link: saved.link,
            isRead: saved.isRead,
            createdAt: saved.createdAt,
        });

        // Also emit to general notification channel
        this.eventsGateway.server.emit('notification:new', {
            userId: data.userId,
            notification: saved,
        });

        return saved;
    }

    async findAllForUser(
        userId: string,
        filters?: {
            category?: NotificationCategory;
            isRead?: boolean;
            limit?: number;
        },
    ): Promise<Notification[]> {
        const query = this.notificationRepo
            .createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .orderBy('n.createdAt', 'DESC');

        if (filters?.category) {
            query.andWhere('n.category = :category', { category: filters.category });
        }

        if (filters?.isRead !== undefined) {
            query.andWhere('n.isRead = :isRead', { isRead: filters.isRead });
        }

        query.take(filters?.limit || 50);

        return query.getMany();
    }

    async countUnreadByCategory(userId: string): Promise<Record<NotificationCategory, number>> {
        const results = await this.notificationRepo
            .createQueryBuilder('n')
            .select('n.category', 'category')
            .addSelect('COUNT(*)', 'count')
            .where('n.userId = :userId', { userId })
            .andWhere('n.isRead = false')
            .groupBy('n.category')
            .getRawMany();

        const counts: Record<NotificationCategory, number> = {
            [NotificationCategory.CATEGORY_TICKET]: 0,
            [NotificationCategory.CATEGORY_RENEWAL]: 0,
        };

        for (const row of results) {
            counts[row.category as NotificationCategory] = parseInt(row.count, 10);
        }

        return counts;
    }

    async findUnreadForUser(userId: string): Promise<Notification[]> {
        return this.notificationRepo.find({
            where: { userId, isRead: false },
            order: { createdAt: 'DESC' },
        });
    }

    async countUnread(userId: string): Promise<number> {
        return this.notificationRepo.count({
            where: { userId, isRead: false },
        });
    }

    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        const notification = await this.notificationRepo.findOne({
            where: { id, userId },
        });
        if (!notification) return null;

        notification.isRead = true;
        return this.notificationRepo.save(notification);
    }

    async markAllAsRead(userId: string): Promise<void> {
        await this.notificationRepo.update(
            { userId, isRead: false },
            { isRead: true },
        );
    }

    async delete(id: string, userId: string): Promise<void> {
        await this.notificationRepo.delete({ id, userId });
    }

    async deleteAllForUser(userId: string): Promise<void> {
        await this.notificationRepo.delete({ userId });
    }

    // Helper methods for common notification types
    async notifyTicketCreated(userId: string, ticketId: string, ticketNumber: string, title: string) {
        return this.create({
            userId,
            type: NotificationType.TICKET_CREATED,
            title: 'Ticket Created',
            message: `Ticket #${ticketNumber} "${title}" has been created`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyTicketAssigned(userId: string, ticketId: string, ticketNumber: string, assignerName: string) {
        return this.create({
            userId,
            type: NotificationType.TICKET_ASSIGNED,
            title: 'Ticket Assigned',
            message: `You have been assigned to ticket #${ticketNumber} by ${assignerName}`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyTicketUpdated(userId: string, ticketId: string, ticketNumber: string, changes: string) {
        return this.create({
            userId,
            type: NotificationType.TICKET_UPDATED,
            title: 'Ticket Updated',
            message: `Ticket #${ticketNumber} has been updated: ${changes}`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyTicketResolved(userId: string, ticketId: string, ticketNumber: string) {
        return this.create({
            userId,
            type: NotificationType.TICKET_RESOLVED,
            title: 'Ticket Resolved',
            message: `Ticket #${ticketNumber} has been resolved`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyTicketReply(userId: string, ticketId: string, ticketNumber: string, senderName: string) {
        return this.create({
            userId,
            type: NotificationType.TICKET_REPLY,
            title: 'New Reply',
            message: `${senderName} replied to ticket #${ticketNumber}`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyMention(userId: string, ticketId: string, ticketNumber: string, mentionedBy: string) {
        return this.create({
            userId,
            type: NotificationType.MENTION,
            title: 'You were mentioned',
            message: `${mentionedBy} mentioned you in ticket #${ticketNumber}`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifySlaWarning(userId: string, ticketId: string, ticketNumber: string, timeRemaining: string) {
        return this.create({
            userId,
            type: NotificationType.SLA_WARNING,
            title: 'SLA Warning',
            message: `Ticket #${ticketNumber} SLA will expire in ${timeRemaining}`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifySlaBreached(userId: string, ticketId: string, ticketNumber: string) {
        return this.create({
            userId,
            type: NotificationType.SLA_BREACHED,
            title: 'SLA Breached',
            message: `Ticket #${ticketNumber} has breached its SLA target`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    /**
     * Notify all admins and agents about a new ticket
     */
    async notifyNewTicketToAdmins(
        ticketId: string,
        ticketNumber: string,
        title: string,
        priority: string,
        category: string,
        requesterName: string,
        adminIds: string[],
    ) {
        const notifications = [];
        for (const adminId of adminIds) {
            const notification = await this.create({
                userId: adminId,
                type: NotificationType.TICKET_CREATED,
                title: '🎫 New Ticket',
                message: `New ${priority} ticket from ${requesterName}: "${title}" [${category}]`,
                ticketId,
                link: `/admin/tickets/${ticketId}`,
            });
            notifications.push(notification);
        }
        return notifications;
    }
}
