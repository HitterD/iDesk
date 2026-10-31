import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType } from '../../notifications/entities/notification.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';

@Injectable()
export class TicketNoteVisibilityService {
    constructor(private readonly access: TicketNoteAccessService) {}

    async filter<T extends Pick<Notification, 'type' | 'referenceId'>>(userId: string, notifications: T[]): Promise<T[]> {
        const allowed: T[] = [];
        for (const notification of notifications) {
            if (notification.type !== NotificationType.TICKET_NOTE) { allowed.push(notification); continue; }
            if (!notification.referenceId) continue;
            try {
                await this.access.assertMember(notification.referenceId, userId);
                allowed.push(notification);
            } catch (error) {
                if (!(error instanceof NotFoundException)) throw error;
            }
        }
        return allowed;
    }
}
