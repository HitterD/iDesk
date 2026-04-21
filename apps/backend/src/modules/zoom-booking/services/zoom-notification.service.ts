import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { Notification, NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
import { ZoomGateway } from '../gateways/zoom.gateway';
import { ZoomBooking } from '../entities';

/**
 * Format date to Indonesian locale (e.g., "Rabu, 18 Desember 2024")
 */
function formatDateIndonesian(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/**
 * Handles notifications for Zoom booking events
 * Integrates with existing notification system, ZoomGateway for real-time updates,
 * and MailerService for email notifications.
 */
@Injectable()
export class ZoomNotificationService {
    private readonly logger = new Logger(ZoomNotificationService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        private readonly zoomGateway: ZoomGateway,
        private readonly mailerService: MailerService,
    ) { }

    /**
     * Notify user that their booking was confirmed
     */
    async notifyBookingConfirmed(
        userId: string,
        booking: ZoomBooking,
        meetingLink?: string,
    ): Promise<void> {
        const notification = this.notificationRepo.create({
            userId,
            type: NotificationType.ZOOM_BOOKING_CONFIRMED,
            category: NotificationCategory.CATEGORY_ZOOM,
            title: '✅ Zoom Booking Confirmed',
            message: `Your booking "${booking.title}" on ${booking.bookingDate} at ${booking.startTime} has been confirmed.`,
            referenceId: booking.id,
            link: meetingLink || `/zoom-calendar`,
            isRead: false,
        });

        await this.notificationRepo.save(notification);

        // Emit via ZoomGateway for real-time calendar update
        this.zoomGateway.emitBookingCreated(booking.zoomAccountId, {
            id: booking.id,
            title: booking.title,
            date: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
        });

        this.logger.log(`Notified user ${userId} of booking confirmation ${booking.id}`);
    }

    /**
     * Notify user that their booking was cancelled
     */
    async notifyBookingCancelled(
        userId: string,
        booking: ZoomBooking,
        reason: string,
        cancelledByName: string,
    ): Promise<void> {
        const notification = this.notificationRepo.create({
            userId,
            type: NotificationType.ZOOM_BOOKING_CANCELLED,
            category: NotificationCategory.CATEGORY_ZOOM,
            title: '❌ Zoom Booking Cancelled',
            message: `Your booking "${booking.title}" on ${booking.bookingDate} has been cancelled by ${cancelledByName}. Reason: ${reason}`,
            referenceId: booking.id,
            link: `/zoom-calendar`,
            isRead: false,
        });

        await this.notificationRepo.save(notification);

        // Emit via ZoomGateway for real-time calendar update
        this.zoomGateway.emitBookingCancelled(booking.zoomAccountId, booking.id, reason);

        this.logger.log(`Notified user ${userId} of booking cancellation ${booking.id}`);
    }

    /**
     * Notify user of upcoming booking (reminder)
     */
    async notifyBookingReminder(
        userId: string,
        booking: ZoomBooking,
        minutesBefore: number,
    ): Promise<void> {
        const notification = this.notificationRepo.create({
            userId,
            type: NotificationType.ZOOM_BOOKING_REMINDER,
            category: NotificationCategory.CATEGORY_ZOOM,
            title: `⏰ Meeting Starting in ${minutesBefore} minutes`,
            message: `Your Zoom meeting "${booking.title}" starts at ${booking.startTime}.`,
            referenceId: booking.id,
            link: booking.meeting?.joinUrl || `/zoom-calendar`,
            isRead: false,
        });

        await this.notificationRepo.save(notification);

        this.logger.log(`Sent ${minutesBefore}min reminder to user ${userId} for booking ${booking.id}`);
    }

    /**
     * Broadcast calendar update to all connected clients
     * Used for real-time calendar sync
     */
    broadcastCalendarUpdate(zoomAccountId: string, action: 'created' | 'cancelled' | 'updated'): void {
        if (action === 'created') {
            this.zoomGateway.emitBookingCreated(zoomAccountId, { action });
        } else if (action === 'cancelled') {
            this.zoomGateway.emitBookingCancelled(zoomAccountId, '');
        } else {
            this.zoomGateway.emitBookingUpdated(zoomAccountId, { action });
        }
        this.logger.debug(`Broadcasted calendar update for account ${zoomAccountId}: ${action}`);
    }

    /**
     * Broadcast settings changed event
     */
    broadcastSettingsChanged(): void {
        this.zoomGateway.emitSettingsChanged();
    }

    /**
     * Broadcast sync completed event
     */
    broadcastSyncCompleted(updatedCount: number): void {
        this.zoomGateway.emitSyncCompleted(updatedCount);
    }

    // ==================== EMAIL NOTIFICATIONS ====================

    /**
     * Send booking confirmation email
     */
    async sendBookingConfirmationEmail(
        recipientEmail: string,
        recipientName: string,
        booking: ZoomBooking,
        joinUrl?: string,
        meetingId?: string,
        passcode?: string,
    ): Promise<void> {
        const formattedDate = formatDateIndonesian(booking.bookingDate);

        try {
            await this.mailerService.sendMail({
                to: recipientEmail,
                subject: `✅ Zoom Meeting Confirmed: ${booking.title}`,
                template: 'zoom-booking',
                context: {
                    headerTitle: 'Zoom Meeting Confirmed',
                    actionBadge: 'CONFIRMED',
                    actionClass: 'action-created',
                    greeting: `Hi ${recipientName}, your Zoom meeting has been scheduled successfully.`,
                    meetingTitle: booking.title,
                    meetingDate: formattedDate,
                    meetingTime: `${booking.startTime.substring(0, 5)} - ${booking.endTime.substring(0, 5)} WIB`,
                    duration: booking.durationMinutes,
                    hostName: booking.zoomAccount?.name || 'Zoom Host',
                    joinUrl,
                    meetingId: meetingId || 'N/A',
                    passcode,
                    note: 'Silakan simpan email ini. Anda dapat menggunakan link di atas untuk bergabung ke meeting.',
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Booking confirmation email sent to ${recipientEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send booking confirmation email to ${recipientEmail}:`, error);
        }
    }

    /**
     * Send booking rescheduled email
     */
    async sendBookingRescheduledEmail(
        recipientEmail: string,
        recipientName: string,
        booking: ZoomBooking,
        oldDate: string,
        oldTime: string,
        joinUrl?: string,
        meetingId?: string,
        passcode?: string,
    ): Promise<void> {
        const formattedDate = formatDateIndonesian(booking.bookingDate);

        try {
            await this.mailerService.sendMail({
                to: recipientEmail,
                subject: `📅 Zoom Meeting Rescheduled: ${booking.title}`,
                template: 'zoom-booking',
                context: {
                    headerTitle: 'Meeting Rescheduled',
                    actionBadge: 'RESCHEDULED',
                    actionClass: 'action-rescheduled',
                    greeting: `Hi ${recipientName}, your Zoom meeting has been rescheduled.`,
                    meetingTitle: booking.title,
                    meetingDate: formattedDate,
                    meetingTime: `${booking.startTime.substring(0, 5)} - ${booking.endTime.substring(0, 5)} WIB`,
                    duration: booking.durationMinutes,
                    hostName: booking.zoomAccount?.name || 'Zoom Host',
                    oldDate,
                    oldTime,
                    joinUrl,
                    meetingId: meetingId || 'N/A',
                    passcode,
                    note: 'Jadwal meeting telah diubah. Pastikan untuk menyesuaikan agenda Anda.',
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Booking rescheduled email sent to ${recipientEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send rescheduled email to ${recipientEmail}:`, error);
        }
    }

    /**
     * Send booking cancelled email
     */
    async sendBookingCancelledEmail(
        recipientEmail: string,
        recipientName: string,
        booking: ZoomBooking,
        cancellationReason: string,
        cancelledByName: string,
    ): Promise<void> {
        const formattedDate = formatDateIndonesian(booking.bookingDate);

        try {
            await this.mailerService.sendMail({
                to: recipientEmail,
                subject: `❌ Zoom Meeting Cancelled: ${booking.title}`,
                template: 'zoom-booking',
                context: {
                    headerTitle: 'Meeting Cancelled',
                    actionBadge: 'CANCELLED',
                    actionClass: 'action-cancelled',
                    greeting: `Hi ${recipientName}, a Zoom meeting has been cancelled.`,
                    meetingTitle: booking.title,
                    meetingDate: formattedDate,
                    meetingTime: `${booking.startTime.substring(0, 5)} - ${booking.endTime.substring(0, 5)} WIB`,
                    duration: booking.durationMinutes,
                    hostName: booking.zoomAccount?.name || 'Zoom Host',
                    cancellationReason: `Dibatalkan oleh: ${cancelledByName}\n\n${cancellationReason}`,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Booking cancelled email sent to ${recipientEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send cancelled email to ${recipientEmail}:`, error);
        }
    }
}
