import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ZoomNotificationService } from './zoom-notification.service';
import { ZoomBooking } from '../entities';

@Injectable()
export class ZoomBookingEventListener {
    private readonly logger = new Logger(ZoomBookingEventListener.name);

    constructor(
        private readonly notificationService: ZoomNotificationService,
    ) {}

    @OnEvent('zoom.booking.created')
    handleBookingCreated(payload: { booking: ZoomBooking; user: any }) {
        this.logger.log(`Handling zoom.booking.created event for booking ID: ${payload.booking.id}`);
        // Broadcast calendar update via WebSocket to all clients
        this.notificationService.broadcastCalendarUpdate(payload.booking.zoomAccountId, 'created');
    }

    @OnEvent('zoom.booking.cancelled')
    handleBookingCancelled(payload: { bookingDetails: any; cancelledBy: any; reason: string; cancelledByOwner?: boolean }) {
        this.logger.log(`Handling zoom.booking.cancelled event for booking ID: ${payload.bookingDetails.id}`);
        // Broadcast calendar update via WebSocket to all clients
        this.notificationService.broadcastCalendarUpdate(payload.bookingDetails.zoomAccountId, 'cancelled');
        
        // Optionally notify the user if cancelled by admin
        if (!payload.cancelledByOwner) {
            this.notificationService.notifyBookingCancelled(
                payload.bookingDetails.bookedByUserId,
                payload.bookingDetails as any, // Cast since it's just details
                payload.reason,
                payload.cancelledBy?.username || 'Admin'
            );
        }
    }

    // We can also handle zoom.meeting.created to send emails later if needed
    @OnEvent('zoom.meeting.created')
    handleMeetingCreated(payload: { booking: ZoomBooking; meeting: any }) {
        this.logger.log(`Handling zoom.meeting.created event for meeting ID: ${payload.meeting?.id}`);
        // For now, let's just use it to notify the user holding the meeting
        // Usually, participants get the email here
    }

    @OnEvent('zoom.sync.completed')
    handleSyncCompleted(payload: { updatedCount: number }) {
        this.logger.log(`Handling zoom.sync.completed event. Updated: ${payload.updatedCount}`);
        this.notificationService.broadcastSyncCompleted(payload.updatedCount);
    }
}
