import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ZoomBooking, ZoomAccount, ZoomMeeting, ZoomParticipant, ZoomSettings, ZoomAuditLog } from '../entities';
import { BookingStatus } from '../enums/booking-status.enum';
import { CreateBookingDto, CancelBookingDto, SendReminderDto } from '../dto';
import { ZoomApiAdapter } from '../adapters/zoom-api.adapter';
import { ZoomNotificationService } from './zoom-notification.service';
import { ZoomQueueService } from './zoom-queue.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { RRuleUtil } from '../utils/rrule.util';
import { v4 as uuidv4 } from 'uuid';

export interface CalendarSlot {
    date: string;
    time: string;
    endTime: string;
    status: 'available' | 'booked' | 'my_booking' | 'blocked' | 'external';
    booking?: {
        id: string;
        title: string;
        bookedBy: string;
        bookedByUserId?: string;
        durationMinutes: number;
        startTime: string;  // Actual booking start time (HH:mm)
        endTime: string;    // Actual booking end time (HH:mm)
        isExternal?: boolean;
        joinUrl?: string;
        department?: string;
        email?: string;
        isDoubleBooking?: boolean;
    };
}

export interface CalendarDay {
    date: string;
    dayOfWeek: number;
    isWorkingDay: boolean;
    isBlocked: boolean;
    slots: CalendarSlot[];
}

export interface MergedCalendarBooking extends NonNullable<CalendarSlot['booking']> {
    zoomAccountId: string;
    accountColorHex: string;
}

export interface MergedCalendarSlot {
    date: string;
    time: string;
    endTime: string;
    status: CalendarSlot['status'];
    bookings: MergedCalendarBooking[];
    bookingsOverflow: number;
    isMyBooking: boolean;
}

export interface MergedCalendarDay {
    date: string;
    dayOfWeek: number;
    isWorkingDay: boolean;
    isBlocked: boolean;
    slots: MergedCalendarSlot[];
}

// Force reload trigger - Dec 18, 2025 18:55
@Injectable()
export class ZoomBookingService {
    private readonly logger = new Logger(ZoomBookingService.name);

    constructor(
        private readonly auditService: AuditService,
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
        @Optional() private readonly notificationService?: ZoomNotificationService,
        @Optional() private readonly queueService?: ZoomQueueService,
    ) { }

    /** Format Date ke YYYY-MM-DD string (local, bukan UTC) */
    private formatLocalDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Get or create default settings
     */
    async getSettings(): Promise<ZoomSettings> {
        const settings = await this.settingsRepo.findOne({ where: {} });
        if (!settings) {
            const newSettings = this.settingsRepo.create({} as Partial<ZoomSettings>);
            return this.settingsRepo.save(newSettings);
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
     * Get distinct upcoming bookings for current user (Performance Optimized)
     */
    async getMyUpcomingBookings(userId: string, limit: number = 5): Promise<ZoomBooking[]> {
        try {
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const nowTimeStr = now.toTimeString().substring(0, 5); // HH:mm

            const bookings = await this.bookingRepo.createQueryBuilder('booking')
                .leftJoinAndSelect('booking.zoomAccount', 'zoomAccount')
                .leftJoinAndSelect('booking.meeting', 'meeting')
                .where('booking.bookedByUserId = :userId', { userId })
                .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
                .andWhere('(booking.bookingDate > :todayStr OR (booking.bookingDate = :todayStr AND booking.startTime > :nowTimeStr))', {
                    todayStr,
                    nowTimeStr
                })
                .orderBy('booking.bookingDate', 'ASC')
                .addOrderBy('booking.startTime', 'ASC')
                .take(limit)
                .getMany();

            // SANITIZATION: Map to plain objects to prevent Circular JSON serialization errors
            return bookings.map(b => ({
                id: b.id,
                title: b.title,
                description: b.description,
                bookingDate: b.bookingDate,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
                status: b.status,
                zoomAccountId: b.zoomAccountId,
                bookedByUserId: b.bookedByUserId,
                zoomAccount: b.zoomAccount ? {
                    id: b.zoomAccount.id,
                    name: b.zoomAccount.name,
                    email: b.zoomAccount.email,
                    colorHex: b.zoomAccount.colorHex,
                } : null,
                meeting: b.meeting ? {
                    joinUrl: b.meeting.joinUrl,
                    password: b.meeting.password,
                } : null,
            })) as any;

        } catch (error: any) {
            this.logger.error(`CRITICAL ERROR in getMyUpcomingBookings: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get current user's own bookings (either created by user or invited as participant)
     */
    async getMyBookings(userId: string, userEmail?: string): Promise<ZoomBooking[]> {
        const qb = this.bookingRepo.createQueryBuilder('booking')
            .leftJoinAndSelect('booking.zoomAccount', 'zoomAccount')
            .leftJoinAndSelect('booking.meeting', 'meeting')
            .leftJoinAndSelect('booking.bookedByUser', 'bookedByUser')
            .leftJoinAndSelect('booking.participants', 'participants')
            .where('booking.bookedByUserId = :userId', { userId });

        if (userEmail) {
            qb.orWhere('participants.email = :userEmail', { userEmail });
        }

        return qb
            .orderBy('booking.bookingDate', 'DESC')
            .addOrderBy('booking.startTime', 'DESC')
            .take(500)
            .getMany();
    }
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
            .leftJoinAndSelect('booking.meeting', 'meeting')
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

    async getMergedCalendar(
        startDate: Date,
        endDate: Date,
        currentUserId: string,
    ): Promise<MergedCalendarDay[]> {
        const settings = await this.getSettings();
        const startDateStr = startDate.toLocaleDateString('en-CA');
        const endDateStr = endDate.toLocaleDateString('en-CA');
        const bookings = await this.bookingRepo
            .createQueryBuilder('booking')
            .leftJoinAndSelect('booking.bookedByUser', 'user')
            .leftJoinAndSelect('booking.meeting', 'meeting')
            .leftJoinAndSelect('booking.zoomAccount', 'zoomAccount')
            .where('zoomAccount.isActive = :isActive', { isActive: true })
            .andWhere('booking.bookingDate >= :startDate', { startDate: startDateStr })
            .andWhere('booking.bookingDate <= :endDate', { endDate: endDateStr })
            .andWhere('booking.status IN (:...statuses)', {
                statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
            })
            .orderBy('booking.startTime', 'ASC')
            .getMany();

        const calendar: MergedCalendarDay[] = [];
        const current = new Date(startDate);
        while (current <= endDate) {
            const date = current.toLocaleDateString('en-CA');
            const dayOfWeek = current.getDay();
            const isWorkingDay = settings.workingDays.includes(dayOfWeek);
            const isBlocked = settings.blockedDates.includes(date);
            const dayBookings = bookings.filter((booking) =>
                new Date(booking.bookingDate).toLocaleDateString('en-CA') === date,
            );
            calendar.push({
                date,
                dayOfWeek,
                isWorkingDay,
                isBlocked,
                slots: this.generateMergedTimeSlots(
                    settings.slotStartTime,
                    settings.slotEndTime,
                    settings.slotIntervalMinutes,
                    date,
                    dayBookings,
                    currentUserId,
                    isWorkingDay && !isBlocked,
                ),
            });
            current.setDate(current.getDate() + 1);
        }
        return calendar;
    }

    private generateMergedTimeSlots(
        startTime: string,
        endTime: string,
        intervalMinutes: number,
        date: string,
        bookings: ZoomBooking[],
        currentUserId: string,
        isAvailable: boolean,
    ): MergedCalendarSlot[] {
        const slots: MergedCalendarSlot[] = [];
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        let currentHour = startHour;
        let currentMin = startMin;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
            const time = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
            const nextMin = currentMin + intervalMinutes;
            const nextHour = currentHour + Math.floor(nextMin / 60);
            const slotBookings = bookings
                .filter((booking) => time >= booking.startTime.substring(0, 5) && time < booking.endTime.substring(0, 5))
                .sort((a, b) => Number(b.bookedByUserId === currentUserId) - Number(a.bookedByUserId === currentUserId))
                .map((booking): MergedCalendarBooking => {
                    const isMy = booking.bookedByUserId === currentUserId;
                    return {
                        id: booking.id,
                        title: booking.title,
                        bookedBy: isMy
                            ? 'Saya'
                            : booking.isExternal ? 'External Meeting' : booking.bookedByUser?.fullName || 'Unknown',
                        bookedByUserId: booking.bookedByUserId,
                        department: (booking.bookedByUser as any)?.department,
                        email: (booking.bookedByUser as any)?.email,
                        durationMinutes: booking.durationMinutes,
                        startTime: booking.startTime.substring(0, 5),
                        endTime: booking.endTime.substring(0, 5),
                        isExternal: booking.isExternal,
                        isDoubleBooking: booking.isDoubleBooking,
                        // PRIVACY: Only the creator of the booking gets the joinUrl in calendar matrix
                        joinUrl: isMy ? booking.meeting?.joinUrl : undefined,
                        zoomAccountId: booking.zoomAccountId,
                        accountColorHex: booking.zoomAccount?.colorHex || '#3b82f6',
                    };
                });
            const isMyBooking = slotBookings.some((booking) => booking.bookedBy === 'Saya');
            slots.push({
                date,
                time,
                endTime: `${nextHour.toString().padStart(2, '0')}:${(nextMin % 60).toString().padStart(2, '0')}`,
                status: !isAvailable ? 'blocked' : slotBookings.length ? 'booked' : 'available',
                bookings: slotBookings,
                bookingsOverflow: 0,
                isMyBooking,
            });
            currentMin = nextMin % 60;
            currentHour = nextHour;
        }
        return slots;
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
                if (overlappingBooking.isExternal) {
                    status = 'external';
                } else {
                    status = overlappingBooking.bookedByUserId === currentUserId ? 'my_booking' : 'booked';
                }
                booking = {
                    id: overlappingBooking.id,
                    title: overlappingBooking.title,
                    bookedBy: overlappingBooking.isExternal ? 'External Meeting' : (overlappingBooking.bookedByUser?.fullName || 'Unknown'),
                    durationMinutes: overlappingBooking.durationMinutes,
                    startTime: normalizeTime(overlappingBooking.startTime),
                    endTime: normalizeTime(overlappingBooking.endTime),
                    isExternal: overlappingBooking.isExternal,
                    joinUrl: overlappingBooking.meeting?.joinUrl,
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
    ): Promise<ZoomBooking | ZoomBooking[]> {
        const settings = await this.getSettings();
        let datesToBook: string[] = [dto.bookingDate];
        let seriesId: string | undefined = undefined;

        if (dto.recurrencePattern) {
            datesToBook = RRuleUtil.generateDates(dto.recurrencePattern, dto.bookingDate);
            if (datesToBook.length === 0) {
                throw new BadRequestException('Pola berulang tidak menghasilkan tanggal yang valid.');
            }
            if (datesToBook.length > 50) {
                throw new BadRequestException('Maksimal 50 jadwal berulang dalam satu pembuatan.');
            }
            seriesId = uuidv4();
        }

        const allAccounts = await this.accountRepo.find({ where: { isActive: true } });
        if (!allAccounts.length) {
            throw new NotFoundException('Tidak ada akun Zoom yang aktif.');
        }

        const results: ZoomBooking[] = [];
        const errors: string[] = [];
        let existingSeriesMeeting: ZoomMeeting | null = null;

        for (const dateStr of datesToBook) {
            const bookingDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (bookingDate < today) {
                errors.push(`Tanggal ${dateStr} sudah lewat.`);
                continue;
            }

            const maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + settings.advanceBookingDays);
            if (bookingDate > maxDate) {
                errors.push(`Tanggal ${dateStr} melebihi batas maksimal ${settings.advanceBookingDays} hari.`);
                continue;
            }

            const dayOfWeek = bookingDate.getDay();
            if (!settings.workingDays.includes(dayOfWeek)) {
                errors.push(`Tanggal ${dateStr} bukan hari kerja.`);
                continue;
            }

            if (settings.blockedDates.includes(dateStr)) {
                errors.push(`Tanggal ${dateStr} diblokir.`);
                continue;
            }

            const [startHour, startMin] = dto.startTime.split(':').map(Number);
            const totalMinutes = startHour * 60 + startMin + dto.durationMinutes;
            if (totalMinutes > 24 * 60) {
                throw new BadRequestException('Meeting must end on the same day (before 24:00). Please select an earlier start time.');
            }
            const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;

            let selectedAccountId: string | null = null;
            let accountFound = false;
            let isDoubleBookingMeeting = false;

            const accountsToTry = dto.zoomAccountId
                ? [
                    allAccounts.find(a => a.id === dto.zoomAccountId),
                    ...allAccounts.filter(a => a.id !== dto.zoomAccountId)
                ].filter(Boolean) as ZoomAccount[]
                : allAccounts;

            for (const account of accountsToTry) {
                const conflict = await this.bookingRepo
                    .createQueryBuilder('booking')
                    .where('booking.zoomAccountId = :accountId', { accountId: account.id })
                    .andWhere('booking.bookingDate = :date', { date: dateStr })
                    .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
                    .andWhere(
                        '(booking.startTime < :endTime AND booking.endTime > :startTime)',
                        { startTime: dto.startTime, endTime }
                    )
                    .getOne();

                if (!conflict) {
                    selectedAccountId = account.id;
                    accountFound = true;
                    break;
                }
            }

            // If all accounts are full, check if emergency double booking is allowed
            if (!accountFound && dto.allowDoubleBooking) {
                for (const account of accountsToTry) {
                    const count = await this.bookingRepo
                        .createQueryBuilder('booking')
                        .where('booking.zoomAccountId = :accountId', { accountId: account.id })
                        .andWhere('booking.bookingDate = :date', { date: dateStr })
                        .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
                        .andWhere(
                            '(booking.startTime < :endTime AND booking.endTime > :startTime)',
                            { startTime: dto.startTime, endTime }
                        )
                        .getCount();

                    if (count === 1) { // Exactly 1 meeting, room for 1 secondary double booking
                        selectedAccountId = account.id;
                        accountFound = true;
                        isDoubleBookingMeeting = true;
                        break;
                    }
                }
            }

            if (!accountFound) {
                errors.push(`Zoom yang Anda pilih pada tanggal ${dateStr} jam ${dto.startTime} tidak tersedia dan sudah penuh di 10 akun. Mohon menghubungi admin di 1607.`);
                continue;
            }

            try {
                const booking = await this._createSingleBooking(
                    dto,
                    dateStr,
                    selectedAccountId!,
                    user,
                    ipAddress,
                    seriesId,
                    dto.recurrencePattern,
                    existingSeriesMeeting,
                    isDoubleBookingMeeting
                );
                if (seriesId && !existingSeriesMeeting && booking.meeting) {
                    existingSeriesMeeting = booking.meeting;
                }
                results.push(booking);
            } catch (err: any) {
                errors.push(`Gagal pada ${dateStr}: ${err.message}`);
            }
        }

        if (results.length === 0) {
            throw new BadRequestException('Gagal membuat jadwal: ' + errors.join(', '));
        }

        return dto.recurrencePattern ? results : results[0];
    }

    /**
     * Checks whether any active account can accept a booking without reserving it.
     */
    async checkAvailability(
        bookingDateStr: string,
        startTime: string,
        durationMinutes: number,
    ): Promise<{ available: boolean; canDoubleBook?: boolean; reason?: string }> {
        const settings = await this.getSettings();

        if (!settings.allowedDurations.includes(durationMinutes)) {
            return {
                available: false,
                reason: `Durasi harus salah satu dari: ${settings.allowedDurations.join(', ')} menit.`,
            };
        }

        const bookingDate = new Date(bookingDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
            return { available: false, reason: `Tanggal ${bookingDateStr} sudah lewat.` };
        }

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + settings.advanceBookingDays);
        if (bookingDate > maxDate) {
            return {
                available: false,
                reason: `Tanggal ${bookingDateStr} melebihi batas maksimal ${settings.advanceBookingDays} hari.`,
            };
        }

        if (!settings.workingDays.includes(bookingDate.getDay())) {
            return { available: false, reason: `Tanggal ${bookingDateStr} bukan hari kerja.` };
        }

        if (settings.blockedDates.includes(bookingDateStr)) {
            return { available: false, reason: `Tanggal ${bookingDateStr} diblokir.` };
        }

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMinute + durationMinutes;
        const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
        const allAccounts = await this.accountRepo.find({ where: { isActive: true } });

        if (!allAccounts.length) {
            return { available: false, reason: 'Tidak ada akun Zoom yang aktif.' };
        }

        let canDoubleBook = false;

        for (const account of allAccounts) {
            const qb = this.bookingRepo
                .createQueryBuilder('booking')
                .where('booking.zoomAccountId = :accountId', { accountId: account.id })
                .andWhere('booking.bookingDate = :date', { date: bookingDateStr })
                .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
                .andWhere(
                    '(booking.startTime < :endTime AND booking.endTime > :startTime)',
                    { startTime, endTime },
                );

            const count = typeof qb.getCount === 'function'
                ? await qb.getCount()
                : ((await qb.getMany?.())?.length ?? (await qb.getOne?.() ? 1 : 0));

            if (count === 0) {
                return { available: true };
            }
            if (count === 1) {
                canDoubleBook = true;
            }
        }

        return {
            available: false,
            canDoubleBook,
            reason: `Semua akun penuh pada ${bookingDateStr}. Zoom yang Anda pilih pada jam tersebut tidak tersedia dan sudah penuh di ${allAccounts.length} akun. Mohon menghubungi admin di 1607.`
        };
    }

    /**
     * Checks availability across all operating slots for a given date and duration.
     * Evaluates in-memory against all active Zoom accounts and confirmed bookings.
     */
    async getDaySlotsAvailability(
        bookingDateStr: string,
        durationMinutes: number = 60,
    ): Promise<{
        date: string;
        durationMinutes: number;
        isWorkingDay: boolean;
        isBlocked: boolean;
        isPast: boolean;
        isFutureExceeded: boolean;
        totalAccounts: number;
        availableSlotsCount: number;
        totalSlotsCount: number;
        isFullyBooked: boolean;
        reason?: string;
        slots: Array<{
            time: string;
            endTime: string;
            available: boolean;
            availableAccountsCount: number;
            totalAccountsCount: number;
            reason?: string;
            exceedsOperatingHours?: boolean;
        }>;
    }> {
        const settings = await this.getSettings();
        const durationNum = Number(durationMinutes) || 60;

        const bookingDate = new Date(`${bookingDateStr}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isPast = bookingDate < today;
        const now = new Date();
        const isToday = bookingDate.getFullYear() === now.getFullYear() &&
            bookingDate.getMonth() === now.getMonth() &&
            bookingDate.getDate() === now.getDate();
        const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + settings.advanceBookingDays);
        const isFutureExceeded = bookingDate > maxDate;
        const isWorkingDay = settings.workingDays.includes(bookingDate.getDay());
        const isBlocked = settings.blockedDates.includes(bookingDateStr);

        const allAccounts = await this.accountRepo.find({ where: { isActive: true } });
        const totalAccounts = allAccounts.length;

        const baseResult = {
            date: bookingDateStr,
            durationMinutes: durationNum,
            isWorkingDay,
            isBlocked,
            isPast,
            isFutureExceeded,
            totalAccounts,
            availableSlotsCount: 0,
            totalSlotsCount: 0,
            isFullyBooked: false,
            slots: [],
        };

        if (isPast) {
            return { ...baseResult, isFullyBooked: true, reason: `Tanggal ${bookingDateStr} sudah lewat.` };
        }
        if (isFutureExceeded) {
            return { ...baseResult, isFullyBooked: true, reason: `Tanggal ${bookingDateStr} melebihi batas maksimal ${settings.advanceBookingDays} hari.` };
        }
        if (!isWorkingDay) {
            return { ...baseResult, isFullyBooked: true, reason: `Tanggal ${bookingDateStr} bukan hari kerja (akhir pekan).` };
        }
        if (isBlocked) {
            return { ...baseResult, isFullyBooked: true, reason: `Tanggal ${bookingDateStr} diblokir / hari libur.` };
        }
        if (totalAccounts === 0) {
            return { ...baseResult, isFullyBooked: true, reason: 'Tidak ada akun Zoom yang aktif.' };
        }

        // Fetch all bookings for this date across all active accounts in ONE single query
        const bookings = await this.bookingRepo
            .createQueryBuilder('booking')
            .where('booking.bookingDate = :date', { date: bookingDateStr })
            .andWhere('booking.status IN (:...statuses)', {
                statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
            })
            .getMany();

        // Pre-group bookings by zoomAccountId for O(1) account lookup
        const bookingsByAccount = new Map<string, Array<{ start: string; end: string }>>();
        for (const b of bookings) {
            if (!b.zoomAccountId) continue;
            const entry = {
                start: b.startTime.substring(0, 5),
                end: b.endTime.substring(0, 5),
            };
            const existing = bookingsByAccount.get(b.zoomAccountId);
            if (existing) {
                existing.push(entry);
            } else {
                bookingsByAccount.set(b.zoomAccountId, [entry]);
            }
        }

        const [startHour, startMin] = (settings.slotStartTime || '08:00').split(':').map(Number);
        const [endHour, endMin] = (settings.slotEndTime || '18:00').split(':').map(Number);
        const interval = settings.slotIntervalMinutes || 30;
        const closingTotalMins = endHour * 60 + endMin;

        let curHour = startHour;
        let curMin = startMin;
        const slots: Array<{
            time: string;
            endTime: string;
            available: boolean;
            availableAccountsCount: number;
            totalAccountsCount: number;
            reason?: string;
            exceedsOperatingHours?: boolean;
        }> = [];

        let availableSlotsCount = 0;

        while (curHour < endHour || (curHour === endHour && curMin < endMin)) {
            const time = `${curHour.toString().padStart(2, '0')}:${curMin.toString().padStart(2, '0')}`;
            const slotStartMins = curHour * 60 + curMin;
            const slotEndMins = slotStartMins + durationNum;

            const endH = Math.floor(slotEndMins / 60);
            const endM = slotEndMins % 60;
            const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

            // Check if meeting would exceed closing time (or exceed 24:00)
            if (slotEndMins > closingTotalMins || slotEndMins > 24 * 60) {
                slots.push({
                    time,
                    endTime: endTimeStr,
                    available: false,
                    availableAccountsCount: 0,
                    totalAccountsCount: totalAccounts,
                    reason: 'Melebihi jam operasional',
                    exceedsOperatingHours: true,
                });
            } else if (isToday && slotStartMins <= currentMinutesNow) {
                // Past slot on today
                slots.push({
                    time,
                    endTime: endTimeStr,
                    available: false,
                    availableAccountsCount: 0,
                    totalAccountsCount: totalAccounts,
                    reason: 'Waktu sudah lewat',
                });
            } else {
                // Count how many accounts have NO conflict with [time, endTimeStr)
                let availableAccountsForSlot = 0;
                for (const account of allAccounts) {
                    const accBookings = bookingsByAccount.get(account.id);
                    if (!accBookings || accBookings.length === 0) {
                        availableAccountsForSlot++;
                        continue;
                    }
                    const hasConflict = accBookings.some(
                        (b) => b.start < endTimeStr && b.end > time
                    );
                    if (!hasConflict) {
                        availableAccountsForSlot++;
                    }
                }

                const isSlotAvailable = availableAccountsForSlot > 0;
                if (isSlotAvailable) {
                    availableSlotsCount++;
                }

                slots.push({
                    time,
                    endTime: endTimeStr,
                    available: isSlotAvailable,
                    availableAccountsCount: availableAccountsForSlot,
                    totalAccountsCount: totalAccounts,
                    reason: isSlotAvailable ? undefined : `Semua akun penuh (${totalAccounts} terpakai)`,
                });
            }

            curMin += interval;
            curHour += Math.floor(curMin / 60);
            curMin = curMin % 60;
        }

        const isFullyBooked = availableSlotsCount === 0;

        return {
            ...baseResult,
            availableSlotsCount,
            totalSlotsCount: slots.length,
            isFullyBooked,
            reason: isFullyBooked ? 'Semua slot jam pada tanggal ini telah penuh terpakai.' : undefined,
            slots,
        };
    }

    /**
     * Internal single booking creator
     */
    async _createSingleBooking(
        dto: CreateBookingDto,
        dateStr: string,
        accountId: string,
        user: { userId: string; username?: string; role?: string },
        ipAddress?: string,
        seriesId?: string,
        recurrencePattern?: string,
        existingSeriesMeeting?: ZoomMeeting | null,
        isDoubleBooking: boolean = false,
    ): Promise<ZoomBooking> {
        const settings = await this.getSettings();
        const account = await this.accountRepo.findOne({ where: { id: accountId, isActive: true } });

        if (!account) {
            throw new NotFoundException('Zoom account not found or inactive');
        }

        // Validate duration - ensure type consistency for comparison
        const durationNum = Number(dto.durationMinutes);
        const allowedDurationsNum = settings.allowedDurations.map(d => Number(d));

        if (!allowedDurationsNum.includes(durationNum)) {
            throw new BadRequestException(`Duration must be one of: ${settings.allowedDurations.join(', ')} minutes`);
        }

        // Calculate end time
        const [startHour, startMin] = dto.startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMin + dto.durationMinutes;
        if (totalMinutes > 24 * 60) {
            throw new BadRequestException('Meeting must end on the same day (before 24:00). Please select an earlier start time.');
        }
        const endHour = Math.floor(totalMinutes / 60);
        const endMin = totalMinutes % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

        // Pre-validate Zoom API readiness if new meeting is needed
        if (!existingSeriesMeeting && !this.zoomApi.isConfigured()) {
            throw new BadRequestException('Zoom API tidak dikonfigurasi. Silakan hubungi administrator.');
        }

        // Check user's daily booking limit before external API call
        const userDailyBookings = await this.bookingRepo.count({
            where: {
                bookedByUserId: user.userId,
                bookingDate: new Date(dateStr),
                status: BookingStatus.CONFIRMED,
            },
        });

        if (userDailyBookings >= settings.maxBookingPerUserPerDay) {
            throw new BadRequestException(`You can only have ${settings.maxBookingPerUserPerDay} bookings per day`);
        }

        // 1. Prepare / Create Zoom Meeting outside DB transaction to prevent pool starvation
        let zoomMeetingData: {
            zoomMeetingId: string;
            joinUrl: string;
            startUrl: string;
            password?: string;
            hostEmail: string;
            meetingSettings: any;
        };
        let freshlyCreatedMeetingId: string | null = null;

        if (existingSeriesMeeting) {
            // Reuse existing Zoom meeting details for recurring series so invitation stays identical
            zoomMeetingData = {
                zoomMeetingId: existingSeriesMeeting.zoomMeetingId,
                joinUrl: existingSeriesMeeting.joinUrl,
                startUrl: isDoubleBooking ? existingSeriesMeeting.joinUrl : existingSeriesMeeting.startUrl,
                password: existingSeriesMeeting.password,
                hostEmail: existingSeriesMeeting.hostEmail,
                meetingSettings: existingSeriesMeeting.meetingSettings,
            };
        } else {
            const startDateTime = new Date(`${dateStr}T${dto.startTime}:00+07:00`);
            const zoomMeeting = await this.zoomApi.createMeeting(
                account.email,
                dto.title,
                startDateTime,
                dto.durationMinutes,
                dto.description,
            );
            freshlyCreatedMeetingId = zoomMeeting.id.toString();
            zoomMeetingData = {
                zoomMeetingId: zoomMeeting.id.toString(),
                joinUrl: zoomMeeting.join_url,
                // DOUBLE BOOKING: Strip startUrl so user cannot claim host
                startUrl: isDoubleBooking ? zoomMeeting.join_url : zoomMeeting.start_url,
                password: zoomMeeting.password,
                hostEmail: zoomMeeting.host_email,
                meetingSettings: zoomMeeting.settings,
            };
        }

        // 2. Fast atomic database operations
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let savedBooking: ZoomBooking;
        let meeting: ZoomMeeting;

        try {
            // Re-verify daily limit inside transaction to avoid race conditions
            const txDailyCount = await queryRunner.manager.count(ZoomBooking, {
                where: {
                    bookedByUserId: user.userId,
                    bookingDate: new Date(dateStr),
                    status: BookingStatus.CONFIRMED,
                },
            });

            if (txDailyCount >= settings.maxBookingPerUserPerDay) {
                throw new BadRequestException(`You can only have ${settings.maxBookingPerUserPerDay} bookings per day`);
            }

            const booking = queryRunner.manager.create(ZoomBooking, {
                zoomAccountId: accountId,
                bookedByUserId: user.userId,
                title: dto.title,
                description: dto.description,
                bookingDate: new Date(dateStr),
                startTime: dto.startTime,
                endTime,
                durationMinutes: dto.durationMinutes,
                status: BookingStatus.CONFIRMED,
                seriesId,
                recurrencePattern,
                isDoubleBooking,
            });

            savedBooking = await queryRunner.manager.save(booking);

            // Add participants
            if (dto.participantEmails?.length) {
                const participants = dto.participantEmails.map(email =>
                    queryRunner.manager.create(ZoomParticipant, {
                        zoomBookingId: savedBooking.id,
                        email,
                        isExternal: true,
                    })
                );
                await queryRunner.manager.save(participants);
            }

            // Save meeting details
            meeting = queryRunner.manager.create(ZoomMeeting, {
                zoomBookingId: savedBooking.id,
                ...zoomMeetingData,
            });
            await queryRunner.manager.save(meeting);

            // Create audit log
            const auditLog = queryRunner.manager.create(ZoomAuditLog, {
                zoomBookingId: savedBooking.id,
                userId: user.userId,
                action: isDoubleBooking ? 'CREATED_DOUBLE_BOOKING' : 'CREATED',
                newValues: {
                    title: dto.title,
                    date: dateStr,
                    time: dto.startTime,
                    isDoubleBooking,
                },
                ipAddress,
            });
            await queryRunner.manager.save(auditLog);

            await queryRunner.commitTransaction();
        } catch (error: any) {
            await queryRunner.rollbackTransaction();

            // Compensation: if Zoom meeting was created on Zoom Cloud, delete it to prevent phantom meetings
            if (freshlyCreatedMeetingId) {
                try {
                    await this.zoomApi.deleteMeeting(freshlyCreatedMeetingId);
                } catch (cleanupErr: any) {
                    this.logger.warn(`Failed to cleanup orphaned Zoom meeting ${freshlyCreatedMeetingId}: ${cleanupErr?.message}`);
                }
            }
            
            if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
                throw error;
            }

            throw new BadRequestException(
                `Gagal membuat Zoom booking: ${error.response?.data?.message || error.message}. Silakan coba lagi.`
            );
        } finally {
            await queryRunner.release();
        }

        // Emit events
        this.eventEmitter.emit('zoom.booking.created', { booking: savedBooking, user });
        this.eventEmitter.emit('zoom.meeting.created', { booking: savedBooking, meeting });

        this.auditService.logAsync({
            userId: user.userId,
            action: AuditAction.ZOOM_BOOKING_CREATE,
            entityType: 'ZoomBooking',
            entityId: savedBooking.id,
            description: `Created Zoom Booking: ${savedBooking.title}`,
            newValue: { date: dateStr, time: dto.startTime, duration: dto.durationMinutes },
        });

        // Re-fetch to get updated status with full relations
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
        const dateStr = this.formatLocalDate(new Date(booking.bookingDate));

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
        } as Partial<ZoomMeeting>);

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

        const isOwner = booking.bookedByUserId === user.userId;
        const isAdmin = user.role === UserRole.ADMIN;

        // this.logger.debug(`getBooking check: bookingId=${bookingId}, userId=${user.userId}, owner=${booking.bookedByUserId}, role=${user.role} -> isOwner=${isOwner}, isAdmin=${isAdmin}`);

        // Load meeting only if user is owner or admin
        if (isOwner || isAdmin) {
            const meeting = await this.meetingRepo.findOne({
                where: { zoomBookingId: bookingId },
            });
            return { ...booking, meeting } as ZoomBooking & { meeting?: ZoomMeeting };
        }

        // EXPLICITLY ensure no meeting data is returned for others
        // (Even though it wasn't fetched, this is double safety)
        const sanitized = { ...booking };
        delete (sanitized as any).meeting;

        return sanitized;
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
        return this.performCancellation(bookingId, dto, user, ipAddress, 'admin');
    }

    private isStaffOrOwner(userRole?: string, ownerId?: string, currentUserId?: string): boolean {
        const STAFF_ROLES: string[] = [
            UserRole.ADMIN,
            UserRole.AGENT_OPERATIONAL_SUPPORT,
            UserRole.AGENT_ADMIN,
            UserRole.AGENT_ORACLE,
            UserRole.AGENT,
            UserRole.MANAGER,
        ];
        if (userRole && STAFF_ROLES.includes(userRole)) {
            return true;
        }
        return ownerId !== undefined && ownerId === currentUserId;
    }

    private async performCancellation(
        bookingId: string,
        dto: CancelBookingDto,
        user: { userId: string; role?: string },
        ipAddress: string | undefined,
        mode: 'admin' | 'owner',
    ): Promise<{ success: boolean; message: string }> {
        const primaryBooking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'meeting', 'zoomAccount'],
        });

        if (!primaryBooking) {
            throw new NotFoundException('Booking not found');
        }

        if (mode === 'admin' && !this.isStaffOrOwner(user.role)) {
            throw new ForbiddenException('Only administrators can cancel bookings');
        }
        
        if (mode === 'owner' && !this.isStaffOrOwner(user.role, primaryBooking.bookedByUserId, user.userId)) {
            throw new ForbiddenException('You can only cancel your own bookings');
        }

        if (primaryBooking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException('Booking is already cancelled');
        }

        let bookingsToCancel = [primaryBooking];

        if (primaryBooking.seriesId && dto.scope && dto.scope !== 'this') {
            const query = this.bookingRepo.createQueryBuilder('booking')
                .leftJoinAndSelect('booking.meeting', 'meeting')
                .leftJoinAndSelect('booking.zoomAccount', 'zoomAccount')
                .leftJoinAndSelect('booking.bookedByUser', 'bookedByUser')
                .where('booking.seriesId = :seriesId', { seriesId: primaryBooking.seriesId })
                .andWhere('booking.id != :id', { id: bookingId }) // primary already in array
                .andWhere('booking.status != :status', { status: BookingStatus.CANCELLED });
            
            if (dto.scope === 'following') {
                query.andWhere('booking.bookingDate >= :date', { date: primaryBooking.bookingDate });
            }

            const relatedBookings = await query.getMany();
            bookingsToCancel = [primaryBooking, ...relatedBookings];
        }

        // Use transaction for database operations
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        const auditAction = mode === 'admin' ? 'CANCELLED' : 'CANCELLED_BY_OWNER';
        const deletedMeetingIds: string[] = [];

        try {
            for (const booking of bookingsToCancel) {
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

                if (booking.meeting?.zoomMeetingId) {
                    deletedMeetingIds.push(booking.meeting.zoomMeetingId);
                }

                await queryRunner.manager.update(ZoomAuditLog,
                    { zoomBookingId: booking.id },
                    { zoomBookingId: null }
                );

                const auditLog = queryRunner.manager.create(ZoomAuditLog, {
                    zoomBookingId: null,
                    userId: user.userId,
                    action: auditAction,
                    oldValues: bookingDetails,
                    newValues: {
                        reason: dto.cancellationReason,
                        deletedAt: new Date().toISOString(),
                    },
                    ipAddress,
                });
                await queryRunner.manager.save(auditLog);

                if (booking.meeting) {
                    await queryRunner.manager.delete(ZoomMeeting, { id: booking.meeting.id });
                }

                await queryRunner.manager.delete(ZoomParticipant, { zoomBookingId: booking.id });
                await queryRunner.manager.delete(ZoomBooking, { id: booking.id });
            }

            await queryRunner.commitTransaction();
            this.logger.log(`Cancelled ${bookingsToCancel.length} bookings starting from ${bookingId} by ${user.userId}`);
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to cancel bookings: ${error.message}`);
            throw new BadRequestException(`Failed to cancel bookings: ${error.message}`);
        } finally {
            await queryRunner.release();
        }

        // Delete Zoom meetings
        for (const zoomMeetingId of deletedMeetingIds) {
            try {
                await this.zoomApi.deleteMeeting(zoomMeetingId);
                this.logger.log(`Deleted Zoom meeting: ${zoomMeetingId}`);
            } catch (error) {
                this.logger.warn(`Failed to delete Zoom meeting ${zoomMeetingId}`);
            }
        }

        // Emit event for the primary booking
        this.eventEmitter.emit('zoom.booking.cancelled', {
            bookingDetails: { id: primaryBooking.id, title: primaryBooking.title },
            cancelledBy: user,
            reason: dto.cancellationReason,
            ...(mode === 'owner' ? { cancelledByOwner: true } : {})
        });

        return { success: true, message: `${bookingsToCancel.length} bookings cancelled and removed successfully` };
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
        dto: { bookingDate: string; startTime: string; durationMinutes?: number; scope?: 'this' | 'following' | 'all' },
        user: { userId: string; role?: string },
        ipAddress?: string,
    ): Promise<ZoomBooking> {
        const primaryBooking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['bookedByUser', 'zoomAccount', 'meeting'],
        });

        if (!primaryBooking) {
            throw new NotFoundException('Booking not found');
        }

        if (!this.isStaffOrOwner(user.role, primaryBooking.bookedByUserId, user.userId)) {
            throw new ForbiddenException('You can only reschedule your own bookings');
        }

        if (primaryBooking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException('Cannot reschedule a cancelled booking');
        }

        let bookingsToUpdate = [primaryBooking];

        if (primaryBooking.seriesId && dto.scope && dto.scope !== 'this') {
            const query = this.bookingRepo.createQueryBuilder('booking')
                .leftJoinAndSelect('booking.meeting', 'meeting')
                .leftJoinAndSelect('booking.zoomAccount', 'zoomAccount')
                .where('booking.seriesId = :seriesId', { seriesId: primaryBooking.seriesId })
                .andWhere('booking.id != :id', { id: bookingId })
                .andWhere('booking.status != :status', { status: BookingStatus.CANCELLED });
            
            if (dto.scope === 'following') {
                query.andWhere('booking.bookingDate >= :date', { date: primaryBooking.bookingDate });
            }

            const relatedBookings = await query.getMany();
            bookingsToUpdate = [primaryBooking, ...relatedBookings];
        }

        const newDuration = dto.durationMinutes || primaryBooking.durationMinutes;
        const [hours, minutes] = dto.startTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + newDuration;
        if (endMinutes > 24 * 60) {
            throw new BadRequestException('Meeting must end on the same day (before 24:00). Please select an earlier start time.');
        }
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

        // Check for conflicts for ALL affected bookings
        for (const booking of bookingsToUpdate) {
            const targetDate = booking.id === bookingId || dto.scope === 'this' ? dto.bookingDate : this.formatLocalDate(booking.bookingDate);
            
            const conflictingBookings = await this.bookingRepo.find({
                where: {
                    zoomAccountId: booking.zoomAccountId,
                    bookingDate: new Date(targetDate),
                    status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                },
            });

            for (const existingBooking of conflictingBookings) {
                if (bookingsToUpdate.some(b => b.id === existingBooking.id)) continue;

                const existingStart = existingBooking.startTime;
                const existingEnd = existingBooking.endTime;

                if (dto.startTime < existingEnd && existingStart < newEndTime) {
                    throw new ConflictException(
                        `Waktu bertabrakan dengan booking "${existingBooking.title}" pada ${targetDate} ` +
                        `(${existingStart} - ${existingEnd}). Silakan pilih waktu lain.`
                    );
                }
            }
        }

        // 1. Update Zoom meetings on Zoom API first (outside DB transaction)
        for (const booking of bookingsToUpdate) {
            if (booking.meeting?.zoomMeetingId) {
                const targetDateStr = booking.id === bookingId || dto.scope === 'this' ? dto.bookingDate : this.formatLocalDate(booking.bookingDate);
                try {
                    const formattedStartTime = `${targetDateStr}T${dto.startTime}:00`;
                    await this.zoomApi.updateMeeting(booking.meeting.zoomMeetingId, {
                        start_time: formattedStartTime,
                        duration: newDuration,
                        timezone: 'Asia/Jakarta',
                    });
                } catch (error: any) {
                    if (this.zoomApi.isScopeError(error)) {
                        throw new ConflictException('Gagal mengubah jadwal Zoom (Zoom Meeting API Scope Error). Silakan hubungi administrator.');
                    }
                    this.logger.error(`Failed to update Zoom meeting: ${error.message}`, error.stack);
                    throw new BadRequestException(`Gagal update Zoom meeting: ${error.response?.data?.message || error.message}`);
                }
            }
        }

        // 2. Fast atomic database updates
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const booking of bookingsToUpdate) {
                const targetDateStr = booking.id === bookingId || dto.scope === 'this' ? dto.bookingDate : this.formatLocalDate(booking.bookingDate);
                const targetDate = new Date(targetDateStr);

                await queryRunner.manager.update(ZoomBooking, booking.id, {
                    bookingDate: targetDate,
                    startTime: dto.startTime,
                    endTime: newEndTime,
                    durationMinutes: newDuration,
                });

                // Audit log
                const auditLog = queryRunner.manager.create(ZoomAuditLog, {
                    zoomBookingId: booking.id,
                    userId: user.userId,
                    action: 'RESCHEDULED',
                    oldValues: {
                        bookingDate: booking.bookingDate,
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        durationMinutes: booking.durationMinutes,
                    },
                    newValues: {
                        bookingDate: targetDate,
                        startTime: dto.startTime,
                        endTime: newEndTime,
                        durationMinutes: newDuration,
                    },
                    ipAddress,
                });
                await queryRunner.manager.save(auditLog);
            }

            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }

        this.eventEmitter.emit('zoom.booking.rescheduled', {
            bookingId,
            user,
        });

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
        } as any);
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
        return this.performCancellation(bookingId, dto, user, ipAddress, 'owner');
    }

    /**
     * Send email reminder & Outlook calendar (.ics) invitation for a booking
     */
    async sendReminder(
        bookingId: string,
        dto: SendReminderDto,
        currentUser: any,
    ): Promise<{ success: boolean; message: string; emailSent: boolean; scheduled: boolean }> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId },
            relations: ['zoomAccount', 'meeting', 'bookedByUser', 'participants'],
        });

        if (!booking) {
            throw new NotFoundException('Booking tidak ditemukan');
        }

        const currentUserId = currentUser.userId || currentUser.id;
        const isOwner = booking.bookedByUserId === currentUserId;
        const userRole = currentUser.role || '';
        const isAdminOrAgent = [
            'ADMIN', 'MANAGER', 'AGENT', 'AGENT_ADMIN', 'AGENT_OPERATIONAL_SUPPORT',
            'AGENT_ORACLE', 'AGENT_WEB_DEV', 'AGENT_MOBILE_DEV'
        ].includes(userRole);

        if (!isOwner && !isAdminOrAgent) {
            throw new ForbiddenException('Anda tidak memiliki izin untuk mengirim pengingat booking ini');
        }

        const recipientEmail = dto.recipientEmail?.trim()
            || booking.bookedByUser?.email
            || currentUser.email;

        if (!recipientEmail) {
            throw new BadRequestException('Email penerima tidak valid atau tidak ditemukan');
        }

        const recipientName = booking.bookedByUser?.fullName || currentUser.fullName || 'User';
        const joinUrl = booking.meeting?.joinUrl;
        const meetingId = booking.meeting?.zoomMeetingId;
        const passcode = booking.meeting?.password;

        let emailSent = false;
        let scheduled = false;

        const sendNow = dto.sendNow !== false;
        if (sendNow && this.notificationService) {
            await this.notificationService.sendBookingReminderEmail(
                recipientEmail,
                recipientName,
                booking,
                joinUrl,
                meetingId,
                passcode,
            );
            emailSent = true;
        }

        if (dto.minutesBefore && dto.minutesBefore > 0 && this.queueService) {
            const rawDate = booking.bookingDate;
            const dateStr = rawDate instanceof Date
                ? rawDate.toISOString().split('T')[0]
                : String(rawDate || '').split('T')[0] || new Date().toISOString().split('T')[0];
            const [year, month, day] = dateStr.split('-').map(Number);
            const [hour, minute] = (booking.startTime || '09:00').split(':').map(Number);
            // Jakarta WIB is UTC+7
            const meetingDateTime = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
            const reminderTime = new Date(meetingDateTime.getTime() - dto.minutesBefore * 60 * 1000);

            if (reminderTime.getTime() > Date.now()) {
                await this.queueService.queueReminder(booking.id, dto.minutesBefore, reminderTime);
                scheduled = true;
            }
        }

        return {
            success: true,
            emailSent,
            scheduled,
            message: sendNow
                ? `Pengingat dan undangan kalender Outlook (.ics) berhasil dikirim ke ${recipientEmail}`
                : `Pengingat otomatis berhasil dijadwalkan untuk ${dto.minutesBefore} menit sebelum meeting`,
        };
    }
}
