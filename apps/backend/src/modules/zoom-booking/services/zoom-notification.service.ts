import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { Notification, NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
import { ZoomGateway } from '../gateways/zoom.gateway';
import { ZoomBooking, ZoomParticipant } from '../entities';

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
 * Generate iCalendar (RFC 5545) event payload for Outlook / Apple / Google Calendar
 */
export function generateIcsCalendar(booking: ZoomBooking, joinUrl?: string, passcode?: string): string {
    const rawDate = booking.bookingDate;
    const dateStr = rawDate instanceof Date
        ? rawDate.toISOString().split('T')[0]
        : String(rawDate || '').split('T')[0] || new Date().toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const [startH, startM] = (booking.startTime || '09:00').split(':').map(Number);
    const [endH, endM] = (booking.endTime || '10:00').split(':').map(Number);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const dtStart = `${year}${pad(month)}${pad(day)}T${pad(startH)}${pad(startM)}00`;
    const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endH)}${pad(endM)}00`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const cleanTitle = (booking.title || 'Zoom Meeting').replace(/\r?\n/g, ' ');
    const descParts = [
        booking.description ? `${booking.description}\n\n` : '',
        joinUrl ? `Link Zoom: ${joinUrl}\n` : '',
        booking.meeting?.zoomMeetingId ? `Meeting ID: ${booking.meeting.zoomMeetingId}\n` : '',
        passcode ? `Passcode: ${passcode}\n` : '',
    ].filter(Boolean).join('');
    const cleanDesc = descParts.replace(/\r?\n/g, '\\n');

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//iDesk//Zoom Booking Calendar//ID',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:zoom-booking-${booking.id}@idesk.internal`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=Asia/Jakarta:${dtStart}`,
        `DTEND;TZID=Asia/Jakarta:${dtEnd}`,
        `SUMMARY:${cleanTitle}`,
        `DESCRIPTION:${cleanDesc}`,
        `LOCATION:${joinUrl || 'Zoom Meeting'}`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Pengingat Meeting: ${cleanTitle}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
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
        @InjectRepository(ZoomBooking)
        private readonly bookingRepo: Repository<ZoomBooking>,
        @InjectRepository(ZoomParticipant)
        private readonly participantRepo: Repository<ZoomParticipant>,
        private readonly zoomGateway: ZoomGateway,
        private readonly mailDispatch: MailDispatchService,
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
     * Send booking confirmation email with attached iCalendar (.ics) invite
     */
    async sendBookingConfirmationEmail(
        recipientEmail: string,
        recipientName: string,
        booking: ZoomBooking,
        joinUrl?: string,
        meetingId?: string,
        passcode?: string,
        customNote?: string,
    ): Promise<void> {
        const formattedDate = formatDateIndonesian(booking.bookingDate);
        const icsContent = generateIcsCalendar(booking, joinUrl, passcode);

        try {
            await this.mailDispatch.send({
                to: recipientEmail,
                subject: `✅ Undangan Zoom Meeting: ${booking.title}`,
                template: 'zoom-booking',
                context: {
                    headerTitle: 'Zoom Meeting Confirmed',
                    actionBadge: 'CONFIRMED',
                    actionClass: 'action-created',
                    greeting: `Halo ${recipientName}, Anda dijadwalkan untuk mengikuti meeting Zoom berikut.`,
                    meetingTitle: booking.title,
                    meetingDate: formattedDate,
                    meetingTime: `${booking.startTime.substring(0, 5)} - ${booking.endTime.substring(0, 5)} WIB`,
                    duration: booking.durationMinutes,
                    hostName: booking.zoomAccount?.name || 'Zoom Host',
                    joinUrl,
                    meetingId: meetingId || 'N/A',
                    passcode,
                    note: customNote || 'File undangan kalender (.ics) terlampir. Buka file tersebut untuk otomatis menambahkan jadwal ke Outlook / Google Calendar Anda.',
                    year: new Date().getFullYear(),
                },
                attachments: [
                    {
                        filename: `zoom-meeting-${(booking.startTime || '0900').replace(':', '')}.ics`,
                        content: icsContent,
                        contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
                    },
                ],
            });
            this.logger.log(`Booking confirmation email sent to ${recipientEmail} with calendar invite`);
        } catch (error) {
            this.logger.error(`Failed to send booking confirmation email to ${recipientEmail}:`, error);
        }
    }

    /**
     * Notify booker and all registered participants via email with calendar (.ics) invite
     */
    async notifyBookingCreatedWithInvites(
        bookingId: string,
        joinUrl?: string,
        meetingId?: string,
        passcode?: string,
    ): Promise<void> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'participants', 'meeting'],
        });

        if (!booking) {
            this.logger.warn(`Cannot send invites: booking ${bookingId} not found`);
            return;
        }

        const effectiveJoinUrl = joinUrl || booking.meeting?.joinUrl;
        const effectiveMeetingId = meetingId || (booking.meeting?.zoomMeetingId ? String(booking.meeting.zoomMeetingId) : undefined);
        const effectivePasscode = passcode || booking.meeting?.password;

        // 1. Send confirmation email + .ics to the booker
        if (booking.bookedByUser?.email) {
            await this.sendBookingConfirmationEmail(
                booking.bookedByUser.email,
                booking.bookedByUser.fullName || 'Pemesan',
                booking,
                effectiveJoinUrl,
                effectiveMeetingId,
                effectivePasscode,
                'Jadwal Zoom Meeting Anda telah berhasil dibuat. File undangan kalender (.ics) terlampir untuk ditambahkan ke kalender Anda.',
            );
        }

        // 2. Send invitation email + .ics to all registered participants
        if (booking.participants && booking.participants.length > 0) {
            for (const participant of booking.participants) {
                if (participant.email && !participant.emailSent) {
                    const recipientName = participant.name || participant.email.split('@')[0];
                    await this.sendBookingConfirmationEmail(
                        participant.email,
                        recipientName,
                        booking,
                        effectiveJoinUrl,
                        effectiveMeetingId,
                        effectivePasscode,
                        `Anda diundang ke meeting Zoom oleh ${booking.bookedByUser?.fullName || 'rekan kerja'}. File undangan kalender (.ics) terlampir untuk ditambahkan ke kalender Anda.`,
                    );

                    participant.emailSent = true;
                    participant.emailSentAt = new Date();
                    await this.participantRepo.save(participant);
                }
            }
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
            await this.mailDispatch.send({
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
            await this.mailDispatch.send({
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

    /**
     * Send booking reminder email with attached iCalendar (.ics) invite
     */
    async sendBookingReminderEmail(
        recipientEmail: string,
        recipientName: string,
        booking: ZoomBooking,
        joinUrl?: string,
        meetingId?: string,
        passcode?: string,
        customNote?: string,
    ): Promise<void> {
        const formattedDate = formatDateIndonesian(booking.bookingDate);
        const icsContent = generateIcsCalendar(booking, joinUrl, passcode);

        try {
            await this.mailDispatch.send({
                to: recipientEmail,
                subject: `⏰ Pengingat Zoom Meeting: ${booking.title}`,
                template: 'zoom-booking',
                context: {
                    headerTitle: 'Pengingat Zoom Meeting',
                    actionBadge: 'REMINDER',
                    actionClass: 'action-created',
                    greeting: `Halo ${recipientName}, ini adalah pengingat untuk jadwal meeting Zoom Anda.`,
                    meetingTitle: booking.title,
                    meetingDate: formattedDate,
                    meetingTime: `${booking.startTime.substring(0, 5)} - ${booking.endTime.substring(0, 5)} WIB`,
                    duration: booking.durationMinutes,
                    hostName: booking.zoomAccount?.name || 'Zoom Host',
                    joinUrl,
                    meetingId: meetingId || 'N/A',
                    passcode,
                    note: customNote || 'File undangan kalender (.ics) terlampir. Anda dapat membukanya untuk otomatis menambahkan jadwal ke Outlook Calendar.',
                    year: new Date().getFullYear(),
                },
                attachments: [
                    {
                        filename: `zoom-meeting-${(booking.startTime || '0900').replace(':', '')}.ics`,
                        content: icsContent,
                        contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
                    },
                ],
            });
            this.logger.log(`Booking reminder email sent to ${recipientEmail} with ICS attachment`);
        } catch (error) {
            this.logger.error(`Failed to send reminder email to ${recipientEmail}:`, error);
        }
    }
}
