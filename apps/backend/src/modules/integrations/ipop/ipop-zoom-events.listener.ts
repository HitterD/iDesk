import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IpopZoomBookingService } from './ipop-zoom-booking.service';
import { IpopWebhookService } from './ipop-webhook.service';

type MeetingCreatedPayload = { booking?: { id?: string } };
type RescheduledPayload = { bookingId: string; bookingIds?: string[] };
type CancelledPayload = { bookingDetails: { id: string; title?: string }; bookingIds?: string[]; seriesId?: string | null };

/**
 * Keeps iPop calendars in sync with Zoom bookings: one callback per occurrence.
 * Cancelled bookings are deleted in iDesk, so their callback carries only the ids.
 */
@Injectable()
export class IpopZoomEventsListener {
    private readonly logger = new Logger(IpopZoomEventsListener.name);

    constructor(
        private readonly bookings: IpopZoomBookingService,
        private readonly webhooks: IpopWebhookService,
    ) {}

    /** Fired once the Zoom link exists: on creation, and when an admin retries a PENDING booking. */
    @OnEvent('zoom.meeting.created', { async: true })
    async onMeetingCreated(event: MeetingCreatedPayload): Promise<void> {
        const id = event?.booking?.id;
        if (id) await this.sendView('zoom_booking.created', [id]);
    }

    @OnEvent('zoom.booking.rescheduled', { async: true })
    async onRescheduled(event: RescheduledPayload): Promise<void> {
        await this.sendView('zoom_booking.updated', event.bookingIds ?? [event.bookingId]);
    }

    @OnEvent('zoom.booking.cancelled', { async: true })
    async onCancelled(event: CancelledPayload): Promise<void> {
        if (!this.webhooks.isEnabled()) return;
        const seriesId = event.seriesId ?? null;
        for (const bookingId of event.bookingIds ?? [event.bookingDetails.id]) {
            await this.safely(bookingId, () => this.webhooks.enqueueZoomBooking('zoom_booking.cancelled', { bookingId, seriesId }));
        }
    }

    private async sendView(event: 'zoom_booking.created' | 'zoom_booking.updated', bookingIds: string[]): Promise<void> {
        if (!this.webhooks.isEnabled()) return;
        for (const bookingId of bookingIds) {
            await this.safely(bookingId, async () => {
                const view = await this.bookings.loadView(bookingId);
                if (view) await this.webhooks.enqueueZoomBooking(event, view);
            });
        }
    }

    /** A failed callback is logged; it never breaks the booking flow. */
    private async safely(bookingId: string, run: () => Promise<void>): Promise<void> {
        try {
            await run();
        } catch (error) {
            this.logger.error(`Could not queue iPop webhook for Zoom booking ${bookingId}: ${(error as Error).message}`);
        }
    }
}
