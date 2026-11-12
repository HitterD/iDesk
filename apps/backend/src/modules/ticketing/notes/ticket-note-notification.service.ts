import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { DeliveryChannel } from '../../notifications/entities/notification-log.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { TicketNote } from './entities/ticket-note.entity';
import { TicketNoteMember } from './entities/ticket-note-member.entity';
import { NoteDeliveryKind, TicketNoteDelivery } from './entities/ticket-note-delivery.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';

@Injectable()
export class TicketNoteNotificationService {
    private readonly logger = new Logger(TicketNoteNotificationService.name);
    private running = false;
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService,
        @Optional() private readonly center?: NotificationCenterService, @Optional() private readonly gateway?: EventsGateway) {}

    async enqueue(manager: EntityManager, note: TicketNote, actorId: string, kind: NoteDeliveryKind, mentions: string[] = [], only?: string[]) {
        const members = await manager.find(TicketNoteMember, { where: { noteId: note.id } });
        const eventId = randomUUID();
        for (const member of members) {
            if (member.userId === actorId || (only && !only.includes(member.userId))) continue;
            await manager.save(TicketNoteDelivery, manager.create(TicketNoteDelivery, {
                eventId, noteId: note.id, recipientId: member.userId, sequence: note.eventSequence,
                kind: mentions.includes(member.userId) ? 'MENTION' : kind,
                dedupKey: `${eventId}:${member.userId}`, state: 'PENDING', attemptCount: 0,
            }));
        }
    }

    @Cron('*/10 * * * * *')
    async flush(): Promise<void> {
        if (this.running || !this.center) return;
        this.running = true;
        try {
            // Postgres returns [rows, affectedCount] for UPDATE ... RETURNING.
            const claimed = await this.source.transaction(manager => manager.query(`
                WITH pending AS (
                    SELECT id FROM ticket_note_deliveries
                    WHERE (state = 'PENDING' OR (state = 'PROCESSING' AND "claimedAt" < now() - interval '5 minutes'))
                        AND "attemptCount" < 5 ORDER BY "createdAt" LIMIT 50 FOR UPDATE SKIP LOCKED
                ) UPDATE ticket_note_deliveries d SET state = 'PROCESSING', "claimedAt" = now(),
                    "attemptCount" = "attemptCount" + 1 FROM pending WHERE d.id = pending.id RETURNING d.*`));
            const pending: TicketNoteDelivery[] = Array.isArray(claimed[0]) ? claimed[0] : claimed;
            for (const delivery of pending) {
                try { await this.deliver(delivery); }
                catch (error) {
                    await this.source.manager.save(TicketNoteDelivery, { ...delivery,
                        state: delivery.attemptCount >= 5 ? 'FAILED' : 'PENDING' });
                    this.logger.warn(`Private note delivery failed: ${(error as Error).message}`);
                }
            }
        } finally { this.running = false; }
    }

    async deliver(delivery: TicketNoteDelivery): Promise<void> {
        let note: TicketNote;
        try { ({ note } = await this.access.assertMember(delivery.noteId, delivery.recipientId)); }
        catch (error) {
            if (!(error instanceof NotFoundException)) throw error;
            await this.source.manager.save(TicketNoteDelivery, { ...delivery, state: 'CANCELLED' });
            return;
        }
        if (!this.center) return;
        await this.source.manager.save(TicketNoteDelivery, { ...delivery, notificationId: delivery.id });
        const notification = await this.center.send({ id: delivery.id, userId: delivery.recipientId,
            type: NotificationType.TICKET_NOTE,
            title: 'Catatan internal',
            message: delivery.kind === 'INVITE' ? 'Anda ditambahkan ke catatan internal.' : 'Ada pembaruan catatan internal untuk Anda.',
            referenceId: note.id, link: `/tickets/${note.ticketId}?noteId=${note.id}`,
            channels: delivery.kind === 'INVITE' ? [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL] : [DeliveryChannel.IN_APP],
        });
        // Null when the member turned these notices off; the delivery is still done.
        await this.source.manager.save(TicketNoteDelivery, { ...delivery, notificationId: notification?.id ?? null,
            state: 'SENT', attemptCount: delivery.attemptCount });
        this.gateway?.server.to(`user:${delivery.recipientId}`).emit('ticket-note:changed', { ticketId: note.ticketId, noteId: note.id });
        this.gateway?.server.to(`user:${delivery.recipientId}`).emit(`action-items:refresh:${delivery.recipientId}`, {});
    }
}
