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
        durationMinutes: number;
        startTime: string;  // Actual booking start time (HH:mm)
        endTime: string;    // Actual booking end time (HH:mm)
        isExternal?: boolean;
        joinUrl?: string;
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
                .map((booking): MergedCalendarBooking => ({
                    id: booking.id,
                    title: booking.title,
                    bookedBy: booking.bookedByUserId === currentUserId
                        ? 'Saya'
                        : booking.isExternal ? 'External Meeting' : booking.bookedByUser?.fullName || 'Unknown',
                    durationMinutes: booking.durationMinutes,
                    startTime: booking.startTime.substring(0, 5),
                    endTime: booking.endTime.substring(0, 5),
                    isExternal: booking.isExternal,
                    joinUrl: booking.meeting?.joinUrl,
                    zoomAccountId: booking.zoomAccountId,
                    accountColorHex: booking.zoomAccount?.colorHex || '#3b82f6',
                }));
            const isMyBooking = slotBookings.some((booking) => booking.bookedBy === 'Saya');
            const visibleBookings = slotBookings.slice(0, 4);
            slots.push({
                date,
                time,
                endTime: `${nextHour.toString().padStart(2, '0')}:${(nextMin % 60).toString().padStart(2, '0')}`,
                status: !isAvailable ? 'blocked' : slotBookings.length ? 'booked' : 'available',
                bookings: visibleBookings,
                bookingsOverflow: Math.max(0, slotBookings.length - visibleBookings.length),
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
            const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;

            let selectedAccountId: string | null = null;
            let accountFound = false;

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

            if (!accountFound) {
                errors.push(`Semua akun penuh pada ${dateStr}`);
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
                    dto.recurrencePattern
                );
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
    ): Promise<{ available: boolean; reason?: string }> {
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

        for (const account of allAccounts) {
            const conflict = await this.bookingRepo
                .createQueryBuilder('booking')
                .where('booking.zoomAccountId = :accountId', { accountId: account.id })
                .andWhere('booking.bookingDate = :date', { date: bookingDateStr })
                .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
                .andWhere(
                    '(booking.startTime < :endTime AND booking.endTime > :startTime)',
                    { startTime, endTime },
                )
                .getOne();

            if (!conflict) {
                return { available: true };
            }
        }

        return { available: false, reason: `Semua akun penuh pada ${bookingDateStr}` };
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
        const endHour = Math.floor(totalMinutes / 60);
        const endMin = totalMinutes % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

        // Use transaction for database operations
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Check user's daily booking limit inside transaction to prevent race conditions too
            const userDailyBookings = await queryRunner.manager.count(ZoomBooking, {
                where: {
                    bookedByUserId: user.userId,
                    bookingDate: new Date(dateStr),
                    status: BookingStatus.CONFIRMED,
                },
            });

            if (userDailyBookings >= settings.maxBookingPerUserPerDay) {
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
                status: BookingStatus.PENDING,
                seriesId,
                recurrencePattern
            });

            const savedBooking = await queryRunner.manager.save(booking);

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

            // Create Zoom meeting
            // Check if Zoom API is configured
            if (!this.zoomApi.isConfigured()) {
                throw new BadRequestException('Zoom API tidak dikonfigurasi. Silakan hubungi administrator.');
            }

            // Format date properly for Zoom API
            const startDateTime = new Date(`${dateStr}T${savedBooking.startTime}:00+07:00`);

            const zoomMeeting = await this.zoomApi.createMeeting(
                account.email,
                savedBooking.title,
                startDateTime,
                savedBooking.durationMinutes,
                savedBooking.description,
            );

            // Save meeting details
            const meeting = queryRunner.manager.create(ZoomMeeting, {
                zoomBookingId: savedBooking.id,
                zoomMeetingId: zoomMeeting.id.toString(),
                joinUrl: zoomMeeting.join_url,
                startUrl: zoomMeeting.start_url,
                password: zoomMeeting.password,
                hostEmail: zoomMeeting.host_email,
                meetingSettings: zoomMeeting.settings,
            });
            await queryRunner.manager.save(meeting);

            // Update booking status to confirmed
            savedBooking.status = BookingStatus.CONFIRMED;
            await queryRunner.manager.save(savedBooking);

            // Create audit log
            const auditLog = queryRunner.manager.create(ZoomAuditLog, {
                zoomBookingId: savedBooking.id,
                userId: user.userId,
                action: 'CREATED',
                newValues: {
                    title: dto.title,
                    date: dateStr,
                    time: dto.startTime,
                },
                ipAddress,
            });
            await queryRunner.manager.save(auditLog);

            await queryRunner.commitTransaction();

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

        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            
            if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
                throw error;
            }

            throw new BadRequestException(
                `Gagal membuat Zoom meeting: ${error.response?.data?.message || error.message}. Silakan coba lagi.`
            );
        } finally {
            await queryRunner.release();
        }
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

        if (mode === 'admin' && user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only administrators can cancel bookings');
        }
        
        if (mode === 'owner' && primaryBooking.bookedByUserId !== user.userId) {
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

        if (primaryBooking.bookedByUserId !== user.userId && user.role !== UserRole.ADMIN) {
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

                if (booking.meeting?.zoomMeetingId) {
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
}
