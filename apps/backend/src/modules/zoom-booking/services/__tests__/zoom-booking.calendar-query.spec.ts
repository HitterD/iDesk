import { ZoomBookingService } from '../zoom-booking.service';
import { BookingStatus } from '../../enums/booking-status.enum';

describe('ZoomBookingService.getMergedCalendar & getCalendar Query Optimization', () => {
    const settings = {
        id: 'settings-1',
        advanceBookingDays: 30,
        workingDays: [1, 2, 3, 4, 5],
        blockedDates: [] as string[],
        allowedDurations: [30, 60, 90, 120],
        slotStartTime: '08:00',
        slotEndTime: '17:00',
        slotIntervalMinutes: 60,
    };

    let qb: any;
    const bookingRepo = {
        createQueryBuilder: jest.fn(),
    };
    const settingsRepo = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
    };
    const accountRepo = {
        find: jest.fn(),
        findOne: jest.fn(),
    };
    let service: ZoomBookingService;

    beforeEach(() => {
        qb = {
            select: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            leftJoin: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([
                {
                    id: 'b-1',
                    title: 'Strategic Meeting',
                    bookingDate: '2026-09-25',
                    startTime: '09:00:00',
                    endTime: '10:00:00',
                    durationMinutes: 60,
                    bookedByUserId: 'user-1',
                    isExternal: false,
                    isDoubleBooking: false,
                    zoomAccountId: 'acc-1',
                    status: BookingStatus.CONFIRMED,
                    zoomAccount: { id: 'acc-1', name: 'Zoom 1', colorHex: '#1E40AF' },
                    bookedByUser: { id: 'user-1', fullName: 'Bagas Admin', email: 'bagas@idesk.com' },
                    meeting: { id: 'm-1', joinUrl: 'https://zoom.us/j/123456789' },
                },
            ]),
        };
        bookingRepo.createQueryBuilder.mockReturnValue(qb);
        settingsRepo.findOne.mockResolvedValue(settings);
        accountRepo.findOne.mockResolvedValue({ id: 'acc-1', name: 'Zoom 1' });

        service = new ZoomBookingService(
            { logAsync: jest.fn() } as any,
            bookingRepo as any,
            accountRepo as any,
            {} as any,
            {} as any,
            settingsRepo as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('getMergedCalendar executes with selective projection and innerJoin on active accounts', async () => {
        const startDate = new Date('2026-09-25T00:00:00');
        const endDate = new Date('2026-09-25T23:59:59');

        const result = await service.getMergedCalendar(startDate, endDate, 'user-1');

        expect(bookingRepo.createQueryBuilder).toHaveBeenCalledWith('booking');
        expect(qb.select).toHaveBeenCalledWith(
            expect.arrayContaining([
                'booking.id',
                'booking.title',
                'booking.bookingDate',
                'booking.startTime',
                'booking.endTime',
                'booking.durationMinutes',
                'booking.bookedByUserId',
                'booking.isExternal',
                'booking.isDoubleBooking',
                'booking.zoomAccountId',
                'booking.status',
            ]),
        );
        expect(qb.innerJoin).toHaveBeenCalledWith(
            'booking.zoomAccount',
            'zoomAccount',
            'zoomAccount.isActive = :isActive',
            { isActive: true },
        );
        expect(qb.addSelect).toHaveBeenCalledWith(['zoomAccount.id', 'zoomAccount.name', 'zoomAccount.colorHex']);
        expect(qb.leftJoin).toHaveBeenCalledWith('booking.bookedByUser', 'user');
        expect(qb.leftJoin).toHaveBeenCalledWith('booking.meeting', 'meeting');

        expect(result).toHaveLength(1);
        expect(result[0].date).toBe('2026-09-25');
        const slotWithBooking = result[0].slots.find((s) => s.time === '09:00');
        expect(slotWithBooking).toBeDefined();
        expect(slotWithBooking?.status).toBe('booked');
        expect(slotWithBooking?.bookings[0].title).toBe('Strategic Meeting');
        expect(slotWithBooking?.bookings[0].bookedBy).toBe('Saya');
    });

    it('getCalendar executes with selective projection for single account', async () => {
        const startDate = new Date('2026-09-25T00:00:00');
        const endDate = new Date('2026-09-25T23:59:59');

        const result = await service.getCalendar('acc-1', startDate, endDate, 'user-1');

        expect(bookingRepo.createQueryBuilder).toHaveBeenCalledWith('booking');
        expect(qb.select).toHaveBeenCalledWith(
            expect.arrayContaining([
                'booking.id',
                'booking.title',
                'booking.bookingDate',
                'booking.startTime',
                'booking.endTime',
                'booking.durationMinutes',
                'booking.bookedByUserId',
                'booking.isExternal',
                'booking.zoomAccountId',
                'booking.status',
            ]),
        );
        expect(qb.leftJoin).toHaveBeenCalledWith('booking.bookedByUser', 'user');
        expect(qb.leftJoin).toHaveBeenCalledWith('booking.meeting', 'meeting');
        expect(qb.where).toHaveBeenCalledWith('booking.zoomAccountId = :zoomAccountId', { zoomAccountId: 'acc-1' });

        expect(result).toHaveLength(1);
        const bookedSlot = result[0].slots.find((s) => s.time === '09:00');
        expect(bookedSlot?.status).toBe('my_booking');
        expect(bookedSlot?.booking?.title).toBe('Strategic Meeting');
    });
});
