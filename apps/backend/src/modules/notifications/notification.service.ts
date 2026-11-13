import { Injectable, Logger, Optional } from '@nestjs/common';
import { TicketNoteVisibilityService } from '../ticketing/notes/ticket-note-visibility.service';

const logger = new Logger('NotificationService');
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, MoreThan, IsNull } from 'typeorm';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';
import { getCategoryFromType } from './utils/category-mapper';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';
import { SjaAdapterService } from '../sja-adapter/sja-adapter.service';
import { NotificationPushService } from './notification-push.service';
import { NotificationPreferenceGate } from './notification-preference-gate.service';
import { PRIORITY_LABEL, TicketPeople, describeTicketChanges, picOf, withWho } from './utils/notification-copy.util';

/** Socket event telling a user's clients that some of their notifications became read. */
export const NOTIFICATIONS_READ_EVENT = 'notifications:read';

export interface NotificationReadTarget {
    ticketId?: string;
    referenceId?: string;
    category?: NotificationCategory;
}

/**
 * Display hints a notification carries to the user's clients and the SJA desktop notifier, never stored:
 * the human ticket number (not the id) and who the notice is from (the PIC, or the requester for agents).
 */
export interface NotificationDisplay {
    ticketNumber?: string;
    senderName?: string;
}

/** Ticket context for the ticket notification helpers: title and the people to name. */
export type TicketNoticeContext = TicketPeople;

/** Notification title for a ticket: its problem title, else its number. */
function ticketTitle(ticketNumber: string, context?: TicketNoticeContext): string {
    return context?.title?.trim() || `Tiket #${ticketNumber}`;
}

/** Upper bound for the critical banner list; the count endpoint reports the real total. */
const MAX_CRITICAL_BANNER = 50;
/** Older reply notifications (no referenceId) are matched to a deleted message within this window of its send time. */
const REDACT_MATCH_WINDOW_MS = 2 * 60 * 1000;
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');
/** Messages a grouped reply notification stands for: "[#N] 3 pesan baru" -> 3, a single "Pesan Baru dari X" -> 1. */
function replyCountOf(title: string): number {
    const m = /\] (\d+) pesan baru$/.exec(title);
    return m ? Number(m[1]) : 1;
}
/**
 * SQL side of internal-note visibility: a TICKET_NOTE notification counts only while its note exists and the user is
 * still a member. The full check (ticket access) still runs on the rows that are returned; this keeps lists and
 * counts in the database instead of loading every notification into memory.
 */
export const VISIBLE_NOTE_SQL = `(n.type::text <> 'TICKET_NOTE' OR EXISTS (
    SELECT 1 FROM ticket_note_members m JOIN ticket_notes tn ON tn.id = m."noteId"
    WHERE m."noteId"::text = n."referenceId"::text AND m."userId"::text = n."userId"::text AND tn."deletedAt" IS NULL))`;

/** Upper bound for the unread list; the unread count endpoint reports the real total. */
const MAX_UNREAD_LIST = 100;

@Injectable()
export class NotificationService {
    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        private readonly eventsGateway: EventsGateway,
        private readonly sjaAdapter: SjaAdapterService,
        @Optional() private readonly webPush?: NotificationPushService,
        @Optional() private readonly noteVisibility?: TicketNoteVisibilityService,
        @Optional() private readonly gate?: NotificationPreferenceGate,
    ) { }

    /** The user's settings for this notification: in-app (bell, toast, SJA) and push. Critical ones always go. */
    private async channelsFor(userId: string, type: string, critical = false): Promise<{ inApp: boolean; push: boolean }> {
        if (!this.gate) return { inApp: true, push: true };
        const [inApp, push] = await Promise.all([
            this.gate.allows(userId, 'in_app', type, { critical }),
            this.gate.allows(userId, 'push', type, { critical }),
        ]);
        return { inApp, push };
    }

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
    } & NotificationDisplay): Promise<Notification | null> {
        const { ticketNumber, senderName, ...stored } = data;
        const display: NotificationDisplay = { ...(ticketNumber ? { ticketNumber } : {}), ...(senderName ? { senderName } : {}) };
        // DEDUP 1: Check existing notification with same type + referenceId + userId within 24h
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
        } else {
            // DEDUP 2 (Fallback): Prevent rapid duplicate notifications for same user + type + title + message within 5 minutes
            const existing = await this.notificationRepo.findOne({
                where: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    createdAt: MoreThan(new Date(Date.now() - 5 * 60 * 1000)),
                },
            });
            if (existing) {
                // Skip duplicate — return existing notification
                return existing;
            }
        }

        // Turned off by the user for this type (or in-app entirely): not stored, not shown, not pushed.
        const allowed = await this.channelsFor(data.userId, data.type, Boolean(data.requiresAcknowledge));
        if (!allowed.inApp) return null;

        // Auto-determine category from type if not provided
        const category = data.category || getCategoryFromType(data.type);
        const notification = this.notificationRepo.create({
            ...stored,
            category,
            requiresAcknowledge: data.requiresAcknowledge || false,
        });
        const saved = await this.notificationRepo.save(notification);

        // Determine event channel based on criticality
        const eventType = data.requiresAcknowledge
            ? 'critical_notification'
            : `notification:${data.userId}`;

        // Emit real-time notification via WebSocket
        try { this.eventsGateway.server.to(`user:${data.userId}`).emit(eventType, {
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
            ...display,
        }); } catch (e) { console.warn('Socket emit failed', e); }

        // Also emit to general notification channel
        try { this.eventsGateway.server.to(`user:${data.userId}`).emit('notification:new', {
            userId: data.userId,
            notification: { ...saved, ...display },
        }); } catch (e) { console.warn('Socket emit failed', e); }

        // Browser notification (works without the desktop notifier app), unless push is off or in quiet hours.
        if (allowed.push) this.webPush?.dispatch(saved);

        // Dispatch to SJA Notification Center Outbox
        try {
            await this.sjaAdapter.dispatchNotification({ ...saved, ...display });
        } catch (sjaErr) {
            console.warn('SJA dispatch failed', sjaErr);
        }

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

        query.andWhere(VISIBLE_NOTE_SQL).take(limit).skip(skip);
        const [rows, total] = await query.getManyAndCount();
        const data = this.noteVisibility ? await this.noteVisibility.filter(userId, rows) : rows;
        return { data, total: total - (rows.length - data.length), page, limit };
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
        this.emitRead(userId);
    }

    /**
     * Marks the user's unread notifications about one thing as read: a ticket, a referenced
     * item (hardware request, e-form, ...) or a whole category. Called when the user opens
     * the page for that thing, so they do not have to clear the bell by hand.
     */
    async markReadByTarget(userId: string, target: NotificationReadTarget): Promise<number> {
        const query = this.notificationRepo
            .createQueryBuilder()
            .update(Notification)
            .set({ isRead: true })
            .where('"userId" = :userId', { userId })
            .andWhere('"isRead" = false');

        if (target.ticketId) {
            query.andWhere('"ticketId" = :ticketId', { ticketId: target.ticketId });
        } else if (target.referenceId) {
            // Hardware requests key each workflow step as `<id>_<step>`.
            query.andWhere('("referenceId" = :referenceId OR "referenceId" LIKE :referencePrefix)', {
                referenceId: target.referenceId,
                referencePrefix: `${target.referenceId}\\_%`,
            });
        } else if (target.category) {
            query.andWhere('"category" = :category', { category: target.category });
        } else {
            return 0;
        }

        const result = await query.execute();
        const updated = result.affected ?? 0;
        if (updated > 0) this.emitRead(userId);
        return updated;
    }

    /** Lets the user's other tabs and devices refresh their badge and lists. */
    private emitRead(userId: string): void {
        try {
            this.eventsGateway.server.to(`user:${userId}`).emit(NOTIFICATIONS_READ_EVENT, { userId });
        } catch (e) {
            logger.warn(`Socket emit failed: ${(e as Error).message}`);
        }
    }

    private async countByCategory(userId: string, unreadOnly: boolean): Promise<Record<NotificationCategory, number>> {
        const query = this.notificationRepo
            .createQueryBuilder('n')
            .select('n.category', 'category')
            .addSelect('COUNT(*)', 'count')
            .where('n.userId = :userId', { userId })
            .andWhere(VISIBLE_NOTE_SQL)
            .groupBy('n.category');
        if (unreadOnly) query.andWhere('n.isRead = false');
        const results = await query.getRawMany();
        const counts = Object.fromEntries(Object.values(NotificationCategory).map(category => [category, 0])) as Record<NotificationCategory, number>;
        for (const row of results) counts[row.category as NotificationCategory] = parseInt(row.count, 10);
        return counts;
    }

    async countUnreadByCategory(userId: string): Promise<Record<NotificationCategory, number>> {
        return this.countByCategory(userId, true);
    }

    async countTotalByCategory(userId: string): Promise<Record<NotificationCategory, number>> {
        return this.countByCategory(userId, false);
    }

    async findUnreadForUser(userId: string): Promise<Notification[]> {
        const rows = await this.notificationRepo.createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .andWhere('n.isRead = false')
            .andWhere(VISIBLE_NOTE_SQL)
            .orderBy('n.createdAt', 'DESC')
            .take(MAX_UNREAD_LIST)
            .getMany();
        return this.noteVisibility ? this.noteVisibility.filter(userId, rows) : rows;
    }

    async countUnread(userId: string): Promise<number> {
        return this.notificationRepo.createQueryBuilder('n')
            .where('n.userId = :userId', { userId })
            .andWhere('n.isRead = false')
            .andWhere(VISIBLE_NOTE_SQL)
            .getCount();
    }

    async markAsRead(id: string, userId: string): Promise<Notification | null> {
        const notification = await this.notificationRepo.findOne({
            where: { id, userId },
        });
        if (!notification) return null;
        if (this.noteVisibility && !(await this.noteVisibility.filter(userId, [notification])).length) return null;

        notification.isRead = true;
        const saved = await this.notificationRepo.save(notification);
        this.emitRead(userId);
        return saved;
    }

    async markAllAsRead(userId: string): Promise<void> {
        await this.notificationRepo.update(
            { userId, isRead: false },
            { isRead: true },
        );
        this.emitRead(userId);
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
                acknowledgedAt: IsNull(),
            },
            order: { createdAt: 'DESC' },
            take: MAX_CRITICAL_BANNER,
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
        try { this.eventsGateway.server.to(`user:${userId}`).emit(`notification:acknowledged:${userId}`, {
            notificationId: saved.id,
            acknowledgedAt: saved.acknowledgedAt,
        }); } catch (e) { console.warn('Socket emit failed', e); }

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
                acknowledgedAt: IsNull(),
            },
        });
    }

    // Helper methods for common notification types
    // Ticket notices: the title is the problem title (never an id), the message a plain sentence plus who.

    /** To the requester. */
    async notifyTicketCreated(userId: string, ticketId: string, ticketNumber: string, title: string) {
        return this.create({
            userId,
            type: NotificationType.TICKET_CREATED,
            title: ticketTitle(ticketNumber, { title }),
            message: `Tiket #${ticketNumber} sudah diterima tim IT.`,
            ticketId,
            ticketNumber,
            link: `/tickets/${ticketId}`,
        });
    }

    /** To the new PIC: who assigned it, and who reported it. */
    async notifyTicketAssigned(userId: string, ticketId: string, ticketNumber: string, assignerName: string, context?: TicketNoticeContext) {
        // 'Auto-assign' adalah penanda sistem, bukan nama orang — jangan
        // ditulis seolah-olah seseorang yang menugaskan.
        const byWhom = assignerName === 'Auto-assign'
            ? 'Ditugaskan kepada Anda secara otomatis'
            : `Ditugaskan kepada Anda oleh ${assignerName}`;
        const requester = context?.requesterName;

        return this.create({
            userId,
            type: NotificationType.TICKET_ASSIGNED,
            title: ticketTitle(ticketNumber, context),
            message: withWho(byWhom, requester ? `Dilaporkan oleh ${requester}` : null),
            ticketId,
            ticketNumber,
            senderName: requester ?? undefined,
            link: `/tickets/${ticketId}`,
        });
    }

    /** To the requester side: what changed, and their PIC. */
    async notifyTicketUpdated(userId: string, ticketId: string, ticketNumber: string, changes: string, context?: TicketNoticeContext) {
        const sentence = describeTicketChanges(changes) || 'Ada perubahan';
        return this.create({
            userId,
            type: NotificationType.TICKET_UPDATED,
            title: ticketTitle(ticketNumber, context),
            message: withWho(sentence, picOf(sentence, context?.assigneeName)),
            ticketId,
            ticketNumber,
            senderName: context?.assigneeName ?? undefined,
            link: `/tickets/${ticketId}`,
        });
    }

    /** To the requester: resolved by the PIC, confirm before the deadline. */
    async notifyTicketResolved(userId: string, ticketId: string, ticketNumber: string, deadlineLabel?: string, context?: TicketNoticeContext) {
        const resolved = withWho('Diselesaikan', picOf('', context?.assigneeName));
        return this.create({
            userId,
            type: NotificationType.TICKET_RESOLVED,
            title: ticketTitle(ticketNumber, context),
            message: deadlineLabel
                ? `${resolved}. Konfirmasi atau sanggah sebelum ${deadlineLabel}; setelah itu tiket otomatis ditutup.`
                : `${resolved}.`,
            ticketId,
            ticketNumber,
            senderName: context?.assigneeName ?? undefined,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyTicketReply(
        userId: string,
        ticketId: string,
        ticketNumber: string,
        senderName: string,
        contentSnippet?: string,
        /** The chat message, so its snippet can be taken back if the message is deleted. */
        messageId?: string,
    ) {
        const cleanSnippet = contentSnippet
            ? (contentSnippet.length > 140 ? contentSnippet.slice(0, 137) + '...' : contentSnippet)
            : '';
        const message = cleanSnippet
            ? `${senderName}: "${cleanSnippet}"`
            : `${senderName} membalas tiket #${ticketNumber}`;

        if (!(await this.channelsFor(userId, NotificationType.TICKET_REPLY)).inApp) return null;
        // One row per ticket while it is unread: the next message updates it ("3 pesan baru") instead of
        // adding a row per message to the bell.
        const unread = await this.notificationRepo.findOne({
            where: { userId, ticketId, type: NotificationType.TICKET_REPLY, isRead: false },
            order: { createdAt: 'DESC' },
        });
        if (unread) {
            const count = replyCountOf(unread.title) + 1;
            return this.refreshGrouped(unread, {
                title: `[#${ticketNumber}] ${count} pesan baru`,
                message,
                // The latest message, so deleting it still takes its snippet back.
                ...(messageId ? { referenceId: messageId } : {}),
            }, { ticketNumber, senderName });
        }

        return this.create({
            userId,
            type: NotificationType.TICKET_REPLY,
            title: `[#${ticketNumber}] Pesan Baru dari ${senderName}`,
            message,
            ticketId,
            // Unique per message, so the 24h referenceId dedup never merges two replies.
            ...(messageId ? { referenceId: messageId } : {}),
            link: `/tickets/${ticketId}`,
            ticketNumber,
            senderName,
        });
    }

    /**
     * Updates a grouped unread notification with the latest event and moves it to the top, then tells the
     * user's clients (bell, toast, SJA) the same way a new one does.
     */
    private async refreshGrouped(
        existing: Notification,
        changes: Pick<Notification, 'title' | 'message'> & { referenceId?: string },
        display: NotificationDisplay,
    ): Promise<Notification> {
        // createdAt is a CreateDateColumn, which save() leaves alone; update() moves the row to the top.
        const createdAt = new Date();
        await this.notificationRepo.update({ id: existing.id }, { ...changes, createdAt });
        const saved = { ...existing, ...changes, createdAt } as Notification;
        const payload = { ...saved, userId: saved.userId, ...display };
        try {
            this.eventsGateway.server.to(`user:${saved.userId}`).emit(`notification:${saved.userId}`, payload);
            this.eventsGateway.server.to(`user:${saved.userId}`).emit('notification:new', { userId: saved.userId, notification: payload });
        } catch (e) { logger.warn(`Socket emit failed: ${e instanceof Error ? e.message : 'unknown error'}`); }
        try {
            await this.sjaAdapter.dispatchNotification(payload);
        } catch (e) { logger.warn(`SJA dispatch failed: ${e instanceof Error ? e.message : 'unknown error'}`); }
        return saved;
    }

    /**
     * A deleted chat message must not live on in the notification list: its quoted snippet becomes the
     * neutral "X membalas tiket #N". Older notifications have no referenceId, so they are matched by
     * ticket, type, sender line and a short window around the send time.
     */
    async redactMessageSnippet(target: { messageId: string; ticketId: string; ticketNumber: string; senderName: string; sentAt: Date }) {
        const windowMs = REDACT_MATCH_WINDOW_MS;
        await this.notificationRepo
            .createQueryBuilder()
            .update(Notification)
            .set({ message: `${target.senderName} membalas tiket #${target.ticketNumber}` })
            .where('type = :type', { type: NotificationType.TICKET_REPLY })
            .andWhere(new Brackets((qb) => {
                qb.where('"referenceId" = :messageId', { messageId: target.messageId })
                    .orWhere(new Brackets((legacy) => {
                        legacy.where('"referenceId" IS NULL')
                            .andWhere('"ticketId" = :ticketId', { ticketId: target.ticketId })
                            .andWhere('message LIKE :senderLine', { senderLine: `${escapeLike(target.senderName)}: "%` })
                            .andWhere('"createdAt" BETWEEN :from AND :to', {
                                from: new Date(target.sentAt.getTime() - windowMs),
                                to: new Date(target.sentAt.getTime() + windowMs),
                            });
                    }));
            }))
            .execute();
    }

    async notifyChatMessage(userId: string, ticketId: string, ticketNumber: string, senderName: string) {
        return this.create({
            userId,
            type: NotificationType.CHAT_MESSAGE_RECEIVED,
            title: 'Pesan baru',
            message: `${senderName} mengirim pesan di tiket #${ticketNumber}.`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifyMention(userId: string, ticketId: string, ticketNumber: string, mentionedBy: string) {
        return this.create({
            userId,
            type: NotificationType.MENTION,
            title: 'Anda disebut',
            message: `${mentionedBy} menyebut Anda di tiket #${ticketNumber}.`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifySlaWarning(userId: string, ticketId: string, ticketNumber: string, timeRemaining: string) {
        return this.create({
            userId,
            type: NotificationType.SLA_WARNING,
            title: 'SLA hampir habis',
            message: `SLA tiket #${ticketNumber} berakhir dalam ${timeRemaining}.`,
            ticketId,
            link: `/tickets/${ticketId}`,
        });
    }

    async notifySlaBreached(userId: string, ticketId: string, ticketNumber: string) {
        return this.create({
            userId,
            type: NotificationType.SLA_BREACHED,
            title: 'SLA terlewati',
            message: `Tiket #${ticketNumber} melewati target SLA.`,
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
        const allowed = new Map(await Promise.all(adminIds.map(async id => [id, await this.channelsFor(id, NotificationType.TICKET_CREATED)] as const)));
        adminIds = adminIds.filter(id => allowed.get(id)?.inApp);
        if (adminIds.length === 0) return [];

        const category_ = getCategoryFromType(NotificationType.TICKET_CREATED);
        // "HARDWARE" -> "Hardware"
        const categoryLabel = category ? category.charAt(0) + category.slice(1).toLowerCase().replace(/_/g, ' ') : '';

        // Create all notification entities in memory
        const notificationEntities = adminIds.map(adminId =>
            this.notificationRepo.create({
                userId: adminId,
                type: NotificationType.TICKET_CREATED,
                category: category_,
                title: ticketTitle(ticketNumber, { title }),
                message: [`Tiket baru · ${PRIORITY_LABEL[priority] ?? priority}`, categoryLabel, requesterName ? `Dilaporkan oleh ${requesterName}` : '']
                    .filter(Boolean).join(' · '),
                ticketId,
                link: `/tickets/${ticketId}`,
            })
        );

        // Batch insert - single database roundtrip
        const savedNotifications = await this.notificationRepo.save(notificationEntities);

        // Emit real-time notifications
        for (const notification of savedNotifications) {
            try { this.eventsGateway.server.to(`user:${notification.userId}`).emit(`notification:${notification.userId}`, {
                id: notification.id,
                type: notification.type,
                category: notification.category,
                title: notification.title,
                message: notification.message,
                ticketId: notification.ticketId,
                link: notification.link,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
                ticketNumber,
                ...(requesterName ? { senderName: requesterName } : {}),
            }); } catch (e) { logger.warn(`Socket emit failed: ${e instanceof Error ? e.message : 'unknown error'}`); }
            // Same events as create(), so the bell, toast and lists refresh for these too.
            try { this.eventsGateway.server.to(`user:${notification.userId}`).emit('notification:new', {
                userId: notification.userId,
                notification: { ...notification, ticketNumber, ...(requesterName ? { senderName: requesterName } : {}) },
            }); } catch (e) { logger.warn(`Socket emit failed: ${e instanceof Error ? e.message : 'unknown error'}`); }
            if (allowed.get(notification.userId)?.push) this.webPush?.dispatch(notification);
        }

        return savedNotifications;
    }
}
