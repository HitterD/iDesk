import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';
import { getCategoryFromType } from './utils/category-mapper';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';

@Injectable()
export class NotificationService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        private readonly eventsGateway: EventsGateway,
    ) { }

    async create(data: {
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        ticketId?: string;
        referenceId?: string;
        link?: string;
        category?: NotificationCategory;
        requiresAcknowledge?: boolean;
    }): Promise<Notification> {
        // DEDUP: Check existing notification with same type + referenceId + userId within 24h
        if (data.referenceId) {
            const existing = await this.notificationRepo.findOne({
                where: {
                    userId: data.userId,
                    type: data.type,
                    referenceId: data.referenceId,
                    createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
                },
            });
            if (existing) {
                // Skip duplicate — return existing notification
                return existing;
            }
        }

        // Auto-determine category from type if not provided
        const category = data.category || getCategoryFromType(data.type);
        const notification = this.notificationRepo.create({
            ...data,
            category,
            requiresAcknowledge: data.requiresAcknowledge || false,
        });
        const saved = await this.notificationRepo.save(notification);

        // Determine event channel based on criticality
        const eventType = data.requiresAcknowledge
            ? 'critical_notification'
            : `notification:${data.userId}`;

        // Emit real-time notification via WebSocket
        this.eventsGateway.server.emit(eventType, {
            id: saved.id,
            type: saved.type,
            category: saved.category,
            title: saved.title,
            message: saved.message,
            ticketId: saved.ticketId,
            referenceId: saved.referenceId,
            link: saved.link,
            isRead: saved.isRead,
            requiresAcknowledge: saved.requiresAcknowledge,
            createdAt: saved.createdAt,
            userId: data.userId,
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
            page?: number;
        },
    ): Promise<{ data: Notification[]; total: number; page: number; limit: number }> {
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

        const limit = filters?.limit || 50;
        const page = filters?.page || 1;
        const skip = (page - 1) * limit;

        query.take(limit).skip(skip);

        const [data, total] = await query.getManyAndCount();

        return { data, total, page, limit };
    }

    async bulkDelete(ids: string[], userId: string): Promise<void> {
        if (!ids || ids.length === 0) return;
        await this.notificationRepo
            .createQueryBuilder()
            .delete()
            .from(Notification)
            .where('id IN (:...ids)', { ids })
            .andWhere('userId = :userId', { userId })
            .execute();
    }

    async bulkMarkAsRead(ids: string[], userId: string): Promise<void> {
        if (!ids || ids.length === 0) return;
        await this.notificationRepo
            .createQueryBuilder()
            .update(Notification)
            .set({ isRead: true })
            .where('id IN (:...ids)', { ids })
            .andWhere('userId = :userId', { userId })
            .execute();
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
            [NotificationCategory.CATEGORY_HARDWARE]: 0,
            [NotificationCategory.CATEGORY_ZOOM]: 0,
            [NotificationCategory.CATEGORY_EFORM]: 0,
        };

        for (const row of results) {
            counts[row.category as NotificationCategory] = parseInt(row.count, 10);
        }

        return counts;
    }

    async countTotalByCategory(userId: string): Promise<Record<NotificationCategory, number>> {
        const results = await this.notificationRepo
            .createQueryBuilder('n')
            .select('n.category', 'category')
            .addSelect('COUNT(*)', 'count')
            .where('n.userId = :userId', { userId })
            .groupBy('n.category')
            .getRawMany();

        const counts: Record<NotificationCategory, number> = {
            [NotificationCategory.CATEGORY_TICKET]: 0,
            [NotificationCategory.CATEGORY_RENEWAL]: 0,
            [NotificationCategory.CATEGORY_HARDWARE]: 0,
            [NotificationCategory.CATEGORY_ZOOM]: 0,
            [NotificationCategory.CATEGORY_EFORM]: 0,
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

    // === CRITICAL NOTIFICATION METHODS ===

    /**
     * Find all unacknowledged critical notifications for a user
     */
    async findUnacknowledgedCritical(userId: string): Promise<Notification[]> {
        return this.notificationRepo.find({
            where: {
                userId,
                requiresAcknowledge: true,
                acknowledgedAt: undefined,
            },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Acknowledge a critical notification
     */
    async acknowledgeNotification(notificationId: string, userId: string): Promise<Notification | null> {
        const notification = await this.notificationRepo.findOne({
            where: { id: notificationId, userId },
        });

        if (!notification) return null;
        if (!notification.requiresAcknowledge) return notification;
        if (notification.acknowledgedAt) return notification; // Already acknowledged

        notification.acknowledgedAt = new Date();
        notification.acknowledgedById = userId;
        notification.isRead = true;

        const saved = await this.notificationRepo.save(notification);

        // Emit acknowledgment event
        this.eventsGateway.server.emit(`notification:acknowledged:${userId}`, {
            notificationId: saved.id,
            acknowledgedAt: saved.acknowledgedAt,
        });

        return saved;
    }

    /**
     * Count unacknowledged critical notifications
     */
    async countUnacknowledgedCritical(userId: string): Promise<number> {
        return this.notificationRepo.count({
            where: {
                userId,
                requiresAcknowledge: true,
                acknowledgedAt: undefined,
            },
        });
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

    async notifyChatMessage(userId: string, ticketId: string, ticketNumber: string, senderName: string) {
        return this.create({
            userId,
            type: NotificationType.CHAT_MESSAGE_RECEIVED,
            title: 'New Chat Message',
            message: `${senderName} sent a message in ticket #${ticketNumber}`,
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
     * Optimized: Uses batch insert for efficiency
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
        if (adminIds.length === 0) return [];

        const category_ = getCategoryFromType(NotificationType.TICKET_CREATED);

        // Create all notification entities in memory
        const notificationEntities = adminIds.map(adminId =>
            this.notificationRepo.create({
                userId: adminId,
                type: NotificationType.TICKET_CREATED,
                category: category_,
                title: 'New Ticket',
                message: `New ${priority} ticket from ${requesterName}: "${title}" [${category}]`,
                ticketId,
                link: `/tickets/${ticketId}`,
            })
        );

        // Batch insert - single database roundtrip
        const savedNotifications = await this.notificationRepo.save(notificationEntities);

        // Emit real-time notifications
        for (const notification of savedNotifications) {
            this.eventsGateway.server.emit(`notification:${notification.userId}`, {
                id: notification.id,
                type: notification.type,
                category: notification.category,
                title: notification.title,
                message: notification.message,
                ticketId: notification.ticketId,
                link: notification.link,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
            });
        }

        return savedNotifications;
    }
}
