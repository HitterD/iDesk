import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ZoomBooking } from '../entities';
import { BookingStatus } from '../enums/booking-status.enum';
import { User } from '../../users/entities/user.entity';
import { ZoomNotificationService } from './zoom-notification.service';

/** How long before the meeting the reminder goes out. */
export const ZOOM_REMINDER_MINUTES = 15;

/**
 * "Meeting starts in 15 minutes" (in-app + push) for the booker and the participants who have an iDesk account.
 * Runs every minute; each booking is claimed with an atomic UPDATE ... RETURNING, so it is reminded once even
 * with several instances. Times are WIB (Asia/Jakarta), like booking dates and start times.
 */
@Injectable()
export class ZoomReminderService {
    private readonly logger = new Logger(ZoomReminderService.name);

    constructor(
        @InjectRepository(ZoomBooking)
        private readonly bookingRepo: Repository<ZoomBooking>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly notifications: ZoomNotificationService,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE, { name: 'zoom-meeting-reminder' })
    async run(): Promise<number> {
        try {
            const ids = await this.claimDue();
            for (const id of ids) await this.remind(id);
            return ids.length;
        } catch (error) {
            this.logger.error(`Zoom reminders failed: ${(error as Error).message}`);
            return 0;
        }
    }

    /** Confirmed bookings starting within the reminder window, not reminded yet. */
    private async claimDue(): Promise<string[]> {
        const result = await this.bookingRepo.query(
            `UPDATE "zoom_bookings" SET "reminderSentAt" = now()
             WHERE "status" = $1 AND "reminderSentAt" IS NULL
               AND ("bookingDate"::date + "startTime"::time) AT TIME ZONE 'Asia/Jakarta'
                   BETWEEN now() AND now() + make_interval(mins => $2)
             RETURNING "id"`,
            [BookingStatus.CONFIRMED, ZOOM_REMINDER_MINUTES],
        );
        const rows: Array<{ id: string }> = Array.isArray(result?.[0]) ? result[0] : result ?? [];
        return rows.map(r => r.id);
    }

    private async remind(bookingId: string): Promise<void> {
        const booking = await this.bookingRepo.findOne({ where: { id: bookingId }, relations: ['participants', 'meeting'] });
        if (!booking) return;
        const emails = (booking.participants ?? []).map(p => p.email?.toLowerCase()).filter((e): e is string => Boolean(e));
        const participantUsers = emails.length
            ? await this.userRepo.find({ where: { email: In(emails), isActive: true }, select: ['id'] })
            : [];
        const recipients = new Set([booking.bookedByUserId, ...participantUsers.map(u => u.id)].filter(Boolean));
        for (const userId of recipients) {
            await this.notifications.notifyBookingReminder(userId, booking, ZOOM_REMINDER_MINUTES)
                .catch(err => this.logger.warn(`Zoom reminder to ${userId} failed: ${err.message}`));
        }
    }
}
