import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ZoomBooking } from '../../zoom-booking/entities/zoom-booking.entity';
import { BookingStatus } from '../../zoom-booking/enums/booking-status.enum';
import { User } from '../../users/entities/user.entity';
import type { IpopZoomBookingQueryDto } from './dto/ipop-zoom-booking.dto';
import { pickPublicBaseUrl } from '../../../shared/mail/app-url.util';

/** Booking times are stored as WIB wall-clock (date + "HH:mm"), see ZoomBookingService. */
const BOOKING_TIMEZONE = 'Asia/Jakarta';
const WIB_OFFSET = '+07:00';
const MAX_RANGE_DAYS = 92;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const MAX_LIST = 500;
const VIEW_RELATIONS = ['bookedByUser', 'zoomAccount', 'meeting', 'participants'];

export interface IpopZoomAttendee {
    nik: string;
    name: string | null;
    role: 'BOOKER' | 'PARTICIPANT';
}

/**
 * A booked Zoom meeting as an iPop calendar entry. Only what attendees need to join:
 * never the host start URL, host email or recordings.
 */
export interface IpopZoomBookingView {
    bookingId: string;
    /** Shared by the occurrences of a recurring booking; each occurrence is its own entry. */
    seriesId: string | null;
    title: string;
    description: string | null;
    start: string;
    end: string;
    timezone: string;
    account: { name: string | null };
    zoom: { meetingId: string | null; joinUrl: string; passcode: string | null };
    /** iDesk users with a NIK: put the entry on each of their iPop calendars. */
    attendees: IpopZoomAttendee[];
    updatedAt: string;
    url: string;
}

type AttendeeUser = Pick<User, 'email' | 'employeeId' | 'fullName'>;

@Injectable()
export class IpopZoomBookingService {
    constructor(
        @InjectRepository(ZoomBooking) private readonly bookingRepo: Repository<ZoomBooking>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        private readonly config: ConfigService,
    ) {}

    /** The calendar entry for a booking, or null when iPop should not show it. */
    async loadView(bookingId: string): Promise<IpopZoomBookingView | null> {
        const booking = await this.bookingRepo.findOne({ where: { id: bookingId }, relations: VIEW_RELATIONS });
        if (!booking) return null;
        const [view] = await this.toViews([booking]);
        return view ?? null;
    }

    async getById(bookingId: string): Promise<IpopZoomBookingView> {
        const view = await this.loadView(bookingId);
        if (!view) throw new NotFoundException(`No Zoom booking ${bookingId} visible to iPop`);
        return view;
    }

    /** Bookings in [from, to] (WIB dates) the user booked or is invited to, earliest first. */
    async find(query: IpopZoomBookingQueryDto): Promise<IpopZoomBookingView[]> {
        const span = (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS;
        if (!(span >= 0 && span < MAX_RANGE_DAYS)) {
            throw new BadRequestException(`"to" must be on or after "from", at most ${MAX_RANGE_DAYS} days`);
        }
        const user = await this.userRepo.findOne({ where: { employeeId: query.nik }, select: ['id', 'email'] });
        if (!user) return [];

        const bookings = await this.bookingRepo.createQueryBuilder('booking')
            .leftJoinAndSelect('booking.bookedByUser', 'bookedByUser')
            .leftJoinAndSelect('booking.zoomAccount', 'zoomAccount')
            .leftJoinAndSelect('booking.meeting', 'meeting')
            .leftJoinAndSelect('booking.participants', 'participants')
            .where(
                `(booking.bookedByUserId = :userId OR EXISTS (
                    SELECT 1 FROM zoom_participants p
                    WHERE p."zoomBookingId" = booking.id AND LOWER(p.email) = :email))`,
                { userId: user.id, email: user.email.toLowerCase() },
            )
            .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
            .andWhere('booking.bookingDate BETWEEN :from AND :to', { from: query.from, to: query.to })
            .orderBy('booking.bookingDate', 'ASC')
            .addOrderBy('booking.startTime', 'ASC')
            .take(MAX_LIST)
            .getMany();
        return this.toViews(bookings);
    }

    /** Confirmed bookings with a join link and at least one attendee iPop knows. */
    private async toViews(bookings: ZoomBooking[]): Promise<IpopZoomBookingView[]> {
        const usersByEmail = await this.internalParticipants(bookings);
        const base = pickPublicBaseUrl(this.config.get<string>('FRONTEND_URL'));
        const views: IpopZoomBookingView[] = [];
        for (const booking of bookings) {
            if (booking.status !== BookingStatus.CONFIRMED || !booking.meeting?.joinUrl) continue;
            const attendees = attendeesOf(booking, usersByEmail);
            if (attendees.length === 0) continue;
            const start = wibToDate(localDate(booking.bookingDate), booking.startTime);
            views.push({
                bookingId: booking.id,
                seriesId: booking.seriesId ?? null,
                title: booking.title,
                description: booking.description ?? null,
                start: start.toISOString(),
                // From the duration: endTime may be "24:00" for a meeting that ends at midnight.
                end: new Date(start.getTime() + booking.durationMinutes * MINUTE_MS).toISOString(),
                timezone: BOOKING_TIMEZONE,
                account: { name: booking.zoomAccount?.name ?? null },
                zoom: {
                    meetingId: booking.meeting.zoomMeetingId ?? null,
                    joinUrl: booking.meeting.joinUrl,
                    passcode: booking.meeting.password ?? null,
                },
                attendees,
                updatedAt: new Date(booking.updatedAt).toISOString(),
                url: `${base}/zoom-booking/${booking.id}`,
            });
        }
        return views;
    }

    /** Internal participants are invited by email: resolve them to iDesk users (NIK). */
    private async internalParticipants(bookings: ZoomBooking[]): Promise<Map<string, AttendeeUser>> {
        const emails = [...new Set(bookings.flatMap((b) => (b.participants ?? [])
            .filter((p) => !p.isExternal && p.email)
            .map((p) => p.email.toLowerCase())))];
        if (emails.length === 0) return new Map();
        const users = await this.userRepo.find({
            where: { email: In(emails), isActive: true },
            select: ['email', 'employeeId', 'fullName'],
        });
        return new Map(users.map((u) => [u.email.toLowerCase(), u]));
    }
}

function attendeesOf(booking: ZoomBooking, usersByEmail: Map<string, AttendeeUser>): IpopZoomAttendee[] {
    const attendees: IpopZoomAttendee[] = [];
    const seen = new Set<string>();
    const add = (user: Partial<AttendeeUser> | null | undefined, role: IpopZoomAttendee['role']) => {
        if (!user?.employeeId || seen.has(user.employeeId)) return;
        seen.add(user.employeeId);
        attendees.push({ nik: user.employeeId, name: user.fullName ?? null, role });
    };
    add(booking.bookedByUser, 'BOOKER');
    for (const p of booking.participants ?? []) {
        if (!p.isExternal && p.email) add(usersByEmail.get(p.email.toLowerCase()), 'PARTICIPANT');
    }
    return attendees;
}

/** `date` columns come back as "YYYY-MM-DD"; a Date is read as a local calendar day like ZoomBookingService does. */
function localDate(value: Date | string): string {
    if (typeof value === 'string') return value.slice(0, 10);
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function wibToDate(date: string, time: string): Date {
    return new Date(`${date}T${time.slice(0, 5)}:00${WIB_OFFSET}`);
}
