import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ZoomBooking, ZoomAccount, ZoomMeeting, ZoomParticipant, ZoomSettings, ZoomAuditLog } from '../entities';
import { BookingStatus } from '../enums/booking-status.enum';
import { CreateBookingDto, CancelBookingDto } from '../dto';
import { ZoomApiAdapter } from '../adapters/zoom-api.adapter';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';

export interface CalendarSlot {
    date: string;
    time: string;
    endTime: string;
    status: 'available' | 'booked' | 'my_booking' | 'blocked';
    booking?: {
        id: string;
        title: string;
        bookedBy: string;
        durationMinutes: number;
        startTime: string;  // Actual booking start time (HH:mm)
        endTime: string;    // Actual booking end time (HH:mm)
    };
}

export interface CalendarDay {
    date: string;
    dayOfWeek: number;
    isWorkingDay: boolean;
    isBlocked: boolean;
    slots: CalendarSlot[];
}


// Force reload trigger - Dec 18, 2025 18:55
@Injectable()
export class ZoomBookingService {
    private readonly logger = new Logger(ZoomBookingService.name);

    constructor(
        @InjectRepository(ZoomBooking)
        private readonly bookingRepo: Repository<ZoomBooking>,
        @InjectRepository(ZoomAccount)
        private readonly accountRepo: Repository<ZoomAccount>,
        @InjectRepository(ZoomMeeting)
        private readonly meetingRepo: Repository<ZoomMeeting>,
        @InjectRepository(ZoomParticipant)
        private readonly participantRepo: Repository<ZoomParticipant>,
        @InjectRepository(ZoomSettings)
        private readonly settingsRepo: Repository<ZoomSettings>,
        @InjectRepository(ZoomAuditLog)
        private readonly auditLogRepo: Repository<ZoomAuditLog>,
        private readonly dataSource: DataSource,
        private readonly zoomApi: ZoomApiAdapter,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Get or create default settings
     */
    async getSettings(): Promise<ZoomSettings> {
        let settings = await this.settingsRepo.findOne({ where: {} });
        if (!settings) {
            settings = this.settingsRepo.create({});
            await this.settingsRepo.save(settings);
        }
        return settings;
    }

    /**
     * Get all active Zoom accounts
     */
    async getZoomAccounts(): Promise<ZoomAccount[]> {
        return this.accountRepo.find({
            where: { isActive: true },
            order: { displayOrder: 'ASC' },
        });
    }

    /**
     * Get calendar data for a specific Zoom account
     */
    async getCalendar(
        zoomAccountId: string,
        startDate: Date,
        endDate: Date,
        currentUserId: string,
    ): Promise<CalendarDay[]> {
        const settings = await this.getSettings();
        const account = await this.accountRepo.findOne({ where: { id: zoomAccountId } });

        if (!account) {
            throw new NotFoundException('Zoom account not found');
        }

        // Get all bookings for this account in date range (PENDING and CONFIRMED)
        // Use QueryBuilder for better date handling with date-only columns
        const startDateStr = startDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const endDateStr = endDate.toLocaleDateString('en-CA'); // YYYY-MM-DD

        this.logger.log(`getCalendar QUERY: zoomAccountId=${zoomAccountId}, startDate=${startDateStr}, endDate=${endDateStr}`);

        const bookings = await this.bookingRepo
            .createQueryBuilder('booking')
            .leftJoinAndSelect('booking.bookedByUser', 'user')
            .where('booking.zoomAccountId = :zoomAccountId', { zoomAccountId })
            .andWhere('booking.bookingDate >= :startDate', { startDate: startDateStr })
            .andWhere('booking.bookingDate <= :endDate', { endDate: endDateStr })
            .andWhere('booking.status IN (:...statuses)', {
                statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED]
            })
            .orderBy('booking.startTime', 'ASC')
            .getMany();

        // Debug: Log bookings found
        this.logger.log(`getCalendar: Account ${zoomAccountId}, Range ${startDate.toISOString()} to ${endDate.toISOString()}, Found ${bookings.length} bookings`);
        bookings.forEach(b => {
            const bd = new Date(b.bookingDate);
            this.logger.log(`  Booking: ${b.id}, title="${b.title}", date=${bd.toLocaleDateString('en-CA')}, time=${b.startTime}-${b.endTime}`);
        });

        const calendar: CalendarDay[] = [];
        const current = new Date(startDate);

        while (current <= endDate) {
            // Use local date format (YYYY-MM-DD) to avoid timezone issues
            const dateStr = current.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format
            const dayOfWeek = current.getDay();
            const isWorkingDay = settings.workingDays.includes(dayOfWeek);
            const isBlocked = settings.blockedDates.includes(dateStr);

            // Filter bookings for this day using local date comparison
            const dayBookings = bookings.filter(b => {
                const bookingDateLocal = new Date(b.bookingDate).toLocaleDateString('en-CA');
                return bookingDateLocal === dateStr;
            });

            const slots = this.generateTimeSlots(
                settings.slotStartTime,
                settings.slotEndTime,
                settings.slotIntervalMinutes,
                dateStr,
                dayBookings,
                currentUserId,
                isWorkingDay && !isBlocked,
            );

            calendar.push({
                date: dateStr,
                dayOfWeek,
                isWorkingDay,
                isBlocked,
                slots,
            });

            current.setDate(current.getDate() + 1);
        }

        return calendar;
    }

    /**
     * Generate time slots for a day
     */
    private generateTimeSlots(
        startTime: string,
        endTime: string,
        intervalMinutes: number,
        date: string,
        bookings: ZoomBooking[],
        currentUserId: string,
        isAvailable: boolean,
    ): CalendarSlot[] {
        const slots: CalendarSlot[] = [];
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        let currentHour = startHour;
        let currentMin = startMin;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
            const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
            const nextMin = currentMin + intervalMinutes;
            const nextHour = currentHour + Math.floor(nextMin / 60);
            const endTimeStr = `${nextHour.toString().padStart(2, '0')}:${(nextMin % 60).toString().padStart(2, '0')}`;

            // Find booking that overlaps with this slot
            // IMPORTANT: Normalize time to HH:mm format (PostgreSQL TIME returns HH:mm:ss)
            const normalizeTime = (t: string) => t.substring(0, 5);
            const overlappingBooking = bookings.find(b => {
                const bookingStart = normalizeTime(b.startTime);
                const bookingEnd = normalizeTime(b.endTime);
                return timeStr >= bookingStart && timeStr < bookingEnd;
            });

            let status: CalendarSlot['status'];
            let booking: CalendarSlot['booking'] | undefined;

            if (!isAvailable) {
                status = 'blocked';
            } else if (overlappingBooking) {
                status = overlappingBooking.bookedByUserId === currentUserId ? 'my_booking' : 'booked';
                booking = {
                    id: overlappingBooking.id,
                    title: overlappingBooking.title,
                    bookedBy: overlappingBooking.bookedByUser?.fullName || 'Unknown',
                    durationMinutes: overlappingBooking.durationMinutes,
                    startTime: normalizeTime(overlappingBooking.startTime),
                    endTime: normalizeTime(overlappingBooking.endTime),
                };
            } else {
                status = 'available';
            }

            slots.push({
                date,
                time: timeStr,
                endTime: endTimeStr,
                status,
                booking,
            });

            currentMin = nextMin % 60;
            currentHour = nextHour;
        }

        return slots;
    }

    /**
     * Create a new booking
     */
    async createBooking(
        dto: CreateBookingDto,
        user: { userId: string; username?: string; role?: string },
        ipAddress?: string,
    ): Promise<ZoomBooking> {
        const settings = await this.getSettings();
        const account = await this.accountRepo.findOne({ where: { id: dto.zoomAccountId, isActive: true } });

        if (!account) {
            throw new NotFoundException('Zoom account not found or inactive');
        }

        // Validate booking date
        const bookingDate = new Date(dto.bookingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
            throw new BadRequestException('Cannot book in the past');
        }

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + settings.advanceBookingDays);

        if (bookingDate > maxDate) {
            throw new BadRequestException(`Cannot book more than ${settings.advanceBookingDays} days in advance`);
        }

        // Check working day
        const dayOfWeek = bookingDate.getDay();
        if (!settings.workingDays.includes(dayOfWeek)) {
            throw new BadRequestException('Cannot book on non-working days');
        }

        // Check blocked dates
        if (settings.blockedDates.includes(dto.bookingDate)) {
            throw new BadRequestException('This date is blocked');
        }

        // Validate duration - ensure type consistency for comparison
        const durationNum = Number(dto.durationMinutes);
        const allowedDurationsNum = settings.allowedDurations.map(d => Number(d));
        this.logger.log(`Duration validation: dto.durationMinutes=${dto.durationMinutes} (type: ${typeof dto.durationMinutes}), allowedDurations=${JSON.stringify(settings.allowedDurations)}`);

        if (!allowedDurationsNum.includes(durationNum)) {
            throw new BadRequestException(`Duration must be one of: ${settings.allowedDurations.join(', ')} minutes`);
        }

        // Calculate end time
        const [startHour, startMin] = dto.startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMin + dto.durationMinutes;
        const endHour = Math.floor(totalMinutes / 60);
        const endMin = totalMinutes % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

        // Check for conflicts (overlapping bookings)
        const conflictingBooking = await this.bookingRepo
            .createQueryBuilder('booking')
            .where('booking.zoomAccountId = :accountId', { accountId: dto.zoomAccountId })
            .andWhere('booking.bookingDate = :date', { date: dto.bookingDate })
            .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
            .andWhere(
                '(booking.startTime < :endTime AND booking.endTime > :startTime)',
                { startTime: dto.startTime, endTime }
            )
            .getOne();

        if (conflictingBooking) {
            throw new ConflictException('This time slot is already booked');
        }

        // Check user's daily booking limit
        const userDailyBookings = await this.bookingRepo.count({
            where: {
                bookedByUserId: user.userId,
                bookingDate: new Date(dto.bookingDate),
                status: BookingStatus.CONFIRMED,
            },
        });

        if (userDailyBookings >= settings.maxBookingPerUserPerDay) {
            throw new BadRequestException(`You can only have ${settings.maxBookingPerUserPerDay} bookings per day`);
        }

        // Create booking
        this.logger.log(`Creating booking: accountId=${dto.zoomAccountId}, userId=${user.userId}, date=${dto.bookingDate}, startTime=${dto.startTime}, endTime=${endTime}, duration=${dto.durationMinutes}`);

        const booking = this.bookingRepo.create({
            zoomAccountId: dto.zoomAccountId,
            bookedByUserId: user.userId,
            title: dto.title,
            description: dto.description,
            bookingDate: new Date(dto.bookingDate),
            startTime: dto.startTime,
            endTime,
            durationMinutes: dto.durationMinutes,
            status: BookingStatus.PENDING,
        });

        const savedBooking = await this.bookingRepo.save(booking);

        // Add participants
        if (dto.participantEmails?.length) {
            const participants = dto.participantEmails.map(email =>
                this.participantRepo.create({
                    zoomBookingId: savedBooking.id,
                    email,
                    isExternal: true,
                })
            );
            await this.participantRepo.save(participants);
        }

        // Create Zoom meeting SYNCHRONOUSLY - throw error if fails
        try {
            await this.createZoomMeetingForBooking(savedBooking, account);
        } catch (error: any) {
            // Delete the failed booking so user doesn't see orphan PENDING record
            await this.participantRepo.delete({ zoomBookingId: savedBooking.id });
            await this.bookingRepo.remove(savedBooking);

            this.logger.error(`Failed to create Zoom meeting, booking deleted: ${error.message}`);

            // Re-throw with user-friendly message
            throw new BadRequestException(
                `Gagal membuat Zoom meeting: ${error.response?.data?.message || error.message}. Silakan coba lagi.`
            );
        }

        // Create audit log
        await this.createAuditLog(savedBooking.id, user.userId, 'CREATED', null, {
            title: dto.title,
            date: dto.bookingDate,
            time: dto.startTime,
        }, ipAddress);

        // Emit event for notifications
        this.eventEmitter.emit('zoom.booking.created', {
            booking: savedBooking,
            user,
        });

        // Re-fetch to get updated status (CONFIRMED if Zoom succeeded)
        const updatedBooking = await this.bookingRepo.findOne({
            where: { id: savedBooking.id },
            relations: ['bookedByUser', 'meeting'],
        });

        return updatedBooking || savedBooking;
    }

    /**
     * Create Zoom meeting - throws error on failure (booking will be deleted by caller)
     */
    private async createZoomMeetingForBooking(booking: ZoomBooking, account: ZoomAccount): Promise<void> {
        // Check if Zoom API is configured
        if (!this.zoomApi.isConfigured()) {
            throw new BadRequestException(
                'Zoom API tidak dikonfigurasi. Silakan hubungi administrator.'
            );
        }

        // Format date properly for Zoom API (preserve local date, not UTC)
        // booking.bookingDate is a Date, booking.startTime is "HH:mm" string
        const bookingDate = new Date(booking.bookingDate);
        const year = bookingDate.getFullYear();
        const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
        const day = String(bookingDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // Create ISO string with Asia/Jakarta timezone (+07:00)
        const startDateTime = new Date(`${dateStr}T${booking.startTime}:00+07:00`);

        this.logger.log(`Creating Zoom meeting: date=${dateStr}, time=${booking.startTime}, startDateTime=${startDateTime.toISOString()}`);

        const zoomMeeting = await this.zoomApi.createMeeting(
            account.email,
            booking.title,
            startDateTime,
            booking.durationMinutes,
            booking.description,
        );

        // Save meeting details
        const meeting = this.meetingRepo.create({
            zoomBookingId: booking.id,
            zoomMeetingId: zoomMeeting.id.toString(),
            joinUrl: zoomMeeting.join_url,
            startUrl: zoomMeeting.start_url,
            password: zoomMeeting.password,
            hostEmail: zoomMeeting.host_email,
            meetingSettings: zoomMeeting.settings,
        });

        await this.meetingRepo.save(meeting);

        // Update booking status to confirmed
        await this.bookingRepo.update(booking.id, { status: BookingStatus.CONFIRMED });

        this.logger.log(`Zoom meeting created: ${zoomMeeting.id} for booking ${booking.id}`);

        // Emit event for sending meeting link notification
        this.eventEmitter.emit('zoom.meeting.created', {
            booking,
            meeting,
        });
    }

    /**
     * Get booking by ID with permission check
     */
    async getBooking(bookingId: string, user: { userId: string; role?: string }): Promise<ZoomBooking & { meeting?: ZoomMeeting }> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'participants'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Load meeting only if user is owner or admin
        if (booking.bookedByUserId === user.userId || user.role === UserRole.ADMIN) {
            const meeting = await this.meetingRepo.findOne({
                where: { zoomBookingId: bookingId },
            });
            return { ...booking, meeting } as ZoomBooking & { meeting?: ZoomMeeting };
        }

        return booking;
    }

    /**
     * Cancel a booking (Admin only) - Hard deletes from DB after creating audit log
     * Uses transaction for data integrity
     */
    async cancelBooking(
        bookingId: string,
        dto: CancelBookingDto,
        user: { userId: string; role?: string },
        ipAddress?: string,
    ): Promise<{ success: boolean; message: string }> {
        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only administrators can cancel bookings');
        }

        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'meeting', 'zoomAccount'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException('Booking is already cancelled');
        }

        // Store booking details for audit log before deletion
        const bookingDetails = {
            id: booking.id,
            title: booking.title,
            description: booking.description,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            durationMinutes: booking.durationMinutes,
            status: booking.status,
            bookedByUserId: booking.bookedByUserId,
            bookedByUserName: booking.bookedByUser?.fullName || 'Unknown',
            zoomAccountId: booking.zoomAccountId,
            zoomAccountName: booking.zoomAccount?.name || 'Unknown',
            zoomMeetingId: booking.meeting?.zoomMeetingId,
            joinUrl: booking.meeting?.joinUrl,
        };

        // Delete Zoom meeting if exists (outside transaction - external API)
        if (booking.meeting?.zoomMeetingId) {
            try {
                await this.zoomApi.deleteMeeting(booking.meeting.zoomMeetingId);
                this.logger.log(`Deleted Zoom meeting: ${booking.meeting.zoomMeetingId}`);
            } catch (error) {
                this.logger.warn(`Failed to delete Zoom meeting: ${error}`);
                // Continue with DB deletion even if Zoom API fails
            }
        }

        // Use transaction for database operations
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // First, nullify any existing audit log references to this booking (to avoid FK constraint)
            await queryRunner.manager.update(ZoomAuditLog,
                { zoomBookingId: bookingId },
                { zoomBookingId: null }
            );

            // Create audit log WITHOUT booking FK (booking will be deleted, store ID in oldValues)
            const auditLog = queryRunner.manager.create(ZoomAuditLog, {
                zoomBookingId: null,  // Don't reference the booking that's about to be deleted
                userId: user.userId,
                action: 'CANCELLED',
                oldValues: bookingDetails,  // Contains booking.id for reference
                newValues: {
                    reason: dto.cancellationReason,
                    deletedAt: new Date().toISOString(),
                },
                ipAddress,
            });
            await queryRunner.manager.save(auditLog);

            // Delete meeting record first (foreign key constraint)
            if (booking.meeting) {
                await queryRunner.manager.remove(booking.meeting);
            }

            // Delete participants
            await queryRunner.manager.delete(ZoomParticipant, { zoomBookingId: bookingId });

            // DELETE booking from database (hard delete)
            await queryRunner.manager.remove(booking);

            // Commit transaction
            await queryRunner.commitTransaction();
            this.logger.log(`Booking ${bookingId} deleted by ${user.userId}. Reason: ${dto.cancellationReason}`);
        } catch (error) {
            // Rollback on any failure
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to cancel booking ${bookingId}: ${error.message}`);
            throw new BadRequestException(`Failed to cancel booking: ${error.message}`);
        } finally {
            await queryRunner.release();
        }

        // Emit event for notifications (after successful transaction)
        this.eventEmitter.emit('zoom.booking.cancelled', {
            bookingDetails,
            cancelledBy: user,
            reason: dto.cancellationReason,
        });

        return { success: true, message: 'Booking cancelled and removed successfully' };
    }

    /**
     * Retry creating Zoom meeting for PENDING booking (Admin only)
     */
    async retryZoomMeeting(
        bookingId: string,
        user: { userId: string; role?: string },
        ipAddress?: string,
    ): Promise<ZoomBooking> {
        if (user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only administrators can retry zoom meetings');
        }

        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'meeting'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status !== BookingStatus.PENDING) {
            throw new BadRequestException('Only PENDING bookings can be retried');
        }

        if (booking.meeting) {
            throw new BadRequestException('Booking already has a Zoom meeting');
        }

        const account = booking.zoomAccount;
        if (!account) {
            throw new NotFoundException('Zoom account not found');
        }

        // Try to create Zoom meeting
        await this.createZoomMeetingForBooking(booking, account);

        // Create audit log
        await this.createAuditLog(bookingId, user.userId, 'ZOOM_RETRY',
            { status: BookingStatus.PENDING },
            { status: BookingStatus.CONFIRMED },
            ipAddress
        );

        // Re-fetch with meeting
        const updatedBooking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'meeting'],
        });

        return updatedBooking!;
    }

    /**
     * Reschedule a booking (update date/time) - syncs with Zoom
     */
    async rescheduleBooking(
        bookingId: string,
        dto: { bookingDate: string; startTime: string; durationMinutes?: number },
        user: { userId: string; role?: string },
        ipAddress?: string,
    ): Promise<ZoomBooking> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'meeting'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Check permission - owner or admin
        if (booking.bookedByUserId !== user.userId && user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('You can only reschedule your own bookings');
        }

        // Cannot reschedule cancelled bookings
        if (booking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException('Cannot reschedule a cancelled booking');
        }

        // Store old values for audit
        const oldValues = {
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            durationMinutes: booking.durationMinutes,
        };

        // Calculate new values
        const newDuration = dto.durationMinutes || booking.durationMinutes;
        const [hours, minutes] = dto.startTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + newDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

        // Check for conflicts with other bookings (same account, same date, overlapping time)
        const conflictingBookings = await this.bookingRepo.find({
            where: {
                zoomAccountId: booking.zoomAccountId,
                bookingDate: new Date(dto.bookingDate),
                status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            },
        });

        for (const existingBooking of conflictingBookings) {
            // Skip self
            if (existingBooking.id === bookingId) continue;

            const existingStart = existingBooking.startTime;
            const existingEnd = existingBooking.endTime;
            const newStart = dto.startTime;
            const newEnd = newEndTime;

            // Check overlap: (start1 < end2) AND (start2 < end1)
            if (newStart < existingEnd && existingStart < newEnd) {
                throw new ConflictException(
                    `Waktu bertabrakan dengan booking "${existingBooking.title}" ` +
                    `(${existingStart} - ${existingEnd}). Silakan pilih waktu lain.`
                );
            }
        }

        // Update Zoom meeting if exists
        if (booking.meeting?.zoomMeetingId) {
            try {
                // Format date for Zoom API (local Jakarta time, no Z suffix)
                const bookingDate = new Date(dto.bookingDate);
                const year = bookingDate.getFullYear();
                const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
                const day = String(bookingDate.getDate()).padStart(2, '0');
                const formattedStartTime = `${year}-${month}-${day}T${dto.startTime}:00`;

                await this.zoomApi.updateMeeting(booking.meeting.zoomMeetingId, {
                    start_time: formattedStartTime,
                    duration: newDuration,
                    timezone: 'Asia/Jakarta',
                });

                this.logger.log(`Updated Zoom meeting ${booking.meeting.zoomMeetingId} to ${formattedStartTime}`);
            } catch (error: any) {
                this.logger.error(`Failed to update Zoom meeting: ${error.message}`);
                throw new BadRequestException(
                    `Gagal update Zoom meeting: ${error.response?.data?.message || error.message}`
                );
            }
        }

        // Update database
        await this.bookingRepo.update(bookingId, {
            bookingDate: new Date(dto.bookingDate),
            startTime: dto.startTime,
            endTime: newEndTime,
            durationMinutes: newDuration,
        });

        // Create audit log
        await this.createAuditLog(bookingId, user.userId, 'RESCHEDULED', oldValues, {
            bookingDate: dto.bookingDate,
            startTime: dto.startTime,
            endTime: newEndTime,
            durationMinutes: newDuration,
        }, ipAddress);

        // Emit event
        this.eventEmitter.emit('zoom.booking.rescheduled', {
            bookingId,
            oldValues,
            newValues: { bookingDate: dto.bookingDate, startTime: dto.startTime },
            user,
        });

        // Re-fetch with relations
        const updatedBooking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'meeting'],
        });

        return updatedBooking!;
    }

    /**
     * Get all bookings for admin
     */
    async getAllBookings(
        page: number = 1,
        limit: number = 20,
        filters?: {
            zoomAccountId?: string;
            status?: BookingStatus;
            startDate?: Date;
            endDate?: Date;
        },
    ): Promise<{ data: ZoomBooking[]; total: number }> {
        const query = this.bookingRepo.createQueryBuilder('booking')
            .leftJoinAndSelect('booking.bookedByUser', 'user')
            .leftJoinAndSelect('booking.zoomAccount', 'account')
            .leftJoinAndSelect('booking.meeting', 'meeting');

        if (filters?.zoomAccountId) {
            query.andWhere('booking.zoomAccountId = :accountId', { accountId: filters.zoomAccountId });
        }

        if (filters?.status) {
            query.andWhere('booking.status = :status', { status: filters.status });
        }

        if (filters?.startDate) {
            query.andWhere('booking.bookingDate >= :startDate', { startDate: filters.startDate });
        }

        if (filters?.endDate) {
            query.andWhere('booking.bookingDate <= :endDate', { endDate: filters.endDate });
        }

        query
            .orderBy('booking.bookingDate', 'DESC')
            .addOrderBy('booking.startTime', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        const [data, total] = await query.getManyAndCount();

        return { data, total };
    }

    /**
     * Get user's own bookings
     */
    async getMyBookings(userId: string): Promise<ZoomBooking[]> {
        const bookings = await this.bookingRepo.find({
            where: { bookedByUserId: userId },
            relations: ['zoomAccount', 'meeting'],
            order: { bookingDate: 'DESC', startTime: 'DESC' },
        });

        // Debug: Log all booking IDs with their zoomAccountId
        this.logger.log(`getMyBookings for user ${userId}: Found ${bookings.length} bookings`);
        bookings.forEach(b => {
            const bd = new Date(b.bookingDate);
            this.logger.log(`  Booking: ${b.id}, zoomAccountId=${b.zoomAccountId}, accountName=${b.zoomAccount?.name}, date=${bd.toLocaleDateString('en-CA')}, time=${b.startTime}`);
        });

        return bookings;
    }

    /**
     * Create audit log entry
     */
    private async createAuditLog(
        bookingId: string | null,
        userId: string,
        action: string,
        oldValues: Record<string, any> | null,
        newValues: Record<string, any>,
        ipAddress?: string,
    ): Promise<void> {
        const log = this.auditLogRepo.create({
            zoomBookingId: bookingId,
            userId,
            action,
            oldValues,
            newValues,
            ipAddress,
        });
        await this.auditLogRepo.save(log);
    }

    /**
     * Cancel own booking (any user can cancel their own booking)
     * Unlike cancelBooking (admin only), this only allows owners to cancel
     */
    async cancelBookingByOwner(
        bookingId: string,
        dto: CancelBookingDto,
        user: { userId: string; role?: string },
        ipAddress?: string,
    ): Promise<{ success: boolean; message: string }> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'meeting', 'zoomAccount'],
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Check ownership - only owner can cancel via this method
        if (booking.bookedByUserId !== user.userId) {
            throw new ForbiddenException('You can only cancel your own bookings');
        }

        if (booking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException('Booking is already cancelled');
        }

        // Store booking details for audit log before deletion
        const bookingDetails = {
            id: booking.id,
            title: booking.title,
            description: booking.description,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            durationMinutes: booking.durationMinutes,
            status: booking.status,
            bookedByUserId: booking.bookedByUserId,
            bookedByUserName: booking.bookedByUser?.fullName || 'Unknown',
            zoomAccountId: booking.zoomAccountId,
            zoomAccountName: booking.zoomAccount?.name || 'Unknown',
            zoomMeetingId: booking.meeting?.zoomMeetingId,
            joinUrl: booking.meeting?.joinUrl,
        };

        // Delete Zoom meeting if exists (outside transaction - external API)
        if (booking.meeting?.zoomMeetingId) {
            try {
                await this.zoomApi.deleteMeeting(booking.meeting.zoomMeetingId);
                this.logger.log(`Deleted Zoom meeting: ${booking.meeting.zoomMeetingId}`);
            } catch (error) {
                this.logger.warn(`Failed to delete Zoom meeting: ${error}`);
                // Continue with DB deletion even if Zoom API fails
            }
        }

        // Use transaction for database operations
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Nullify any existing audit log references to this booking
            await queryRunner.manager.update(ZoomAuditLog,
                { zoomBookingId: bookingId },
                { zoomBookingId: null }
            );

            // Create audit log for cancellation (by owner)
            const auditLog = queryRunner.manager.create(ZoomAuditLog, {
                zoomBookingId: null,
                userId: user.userId,
                action: 'CANCELLED_BY_OWNER',
                oldValues: bookingDetails,
                newValues: {
                    reason: dto.cancellationReason,
                    deletedAt: new Date().toISOString(),
                },
                ipAddress,
            });
            await queryRunner.manager.save(auditLog);

            // Delete meeting record first (foreign key constraint)
            if (booking.meeting) {
                await queryRunner.manager.remove(booking.meeting);
            }

            // Delete participants
            await queryRunner.manager.delete(ZoomParticipant, { zoomBookingId: bookingId });

            // DELETE booking from database (hard delete)
            await queryRunner.manager.remove(booking);

            // Commit transaction
            await queryRunner.commitTransaction();
            this.logger.log(`Booking ${bookingId} cancelled by owner ${user.userId}. Reason: ${dto.cancellationReason}`);
        } catch (error) {
            // Rollback on any failure
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to cancel booking ${bookingId}: ${error.message}`);
            throw new BadRequestException(`Failed to cancel booking: ${error.message}`);
        } finally {
            await queryRunner.release();
        }

        // Emit event for notifications
        this.eventEmitter.emit('zoom.booking.cancelled', {
            bookingDetails,
            cancelledBy: user,
            reason: dto.cancellationReason,
            cancelledByOwner: true,
        });

        return { success: true, message: 'Booking cancelled successfully' };
    }
}
