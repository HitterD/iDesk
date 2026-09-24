import { ZoomBookingService } from '../zoom-booking.service';
import { ConflictException } from '@nestjs/common';
import { BookingStatus } from '../../enums/booking-status.enum';

const futureDate = (days = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

describe('ZoomBookingService Recurring Booking', () => {
    let service: ZoomBookingService;
    let bookingRepo: any;
    let accountRepo: any;
    let meetingRepo: any;
    let participantRepo: any;
    let settingsRepo: any;
    let auditLogRepo: any;
    let zoomApi: any;
    let dataSource: any;
    let eventEmitter: any;
    let auditService: any;
    let queryRunner: any;

    const mockSettings = {
        id: 'settings-1',
        advanceBookingDays: 30,
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        blockedDates: [] as string[],
        allowedDurations: [30, 60, 90, 120],
        maxBookingPerUserPerDay: 5,
    };

    const mockAccount = {
        id: 'acc-1',
        email: 'zoom1@example.com',
        name: 'Zoom 1',
        isActive: true,
    };

    beforeEach(() => {
        bookingRepo = {
            createQueryBuilder: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
        };

        accountRepo = {
            find: jest.fn().mockResolvedValue([mockAccount]),
            findOne: jest.fn().mockResolvedValue(mockAccount),
        };

        meetingRepo = {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            save: jest.fn(),
        };

        participantRepo = {};
        settingsRepo = {
            findOne: jest.fn().mockResolvedValue(mockSettings),
            create: jest.fn(),
            save: jest.fn(),
        };

        auditLogRepo = {};

        zoomApi = {
            isConfigured: jest.fn().mockReturnValue(true),
            createMeeting: jest.fn().mockResolvedValue({
                id: 888999111,
                join_url: 'https://zoom.us/j/888999111',
                start_url: 'https://zoom.us/s/888999111',
                password: 'secretpassword',
                host_email: 'zoom1@example.com',
                settings: {},
                occurrences: [
                    { occurrence_id: 'occ-1', start_time: `${futureDate(1)}T07:00:00Z` },
                    { occurrence_id: 'occ-2', start_time: `${futureDate(2)}T07:00:00Z` },
                ],
            }),
            deleteMeeting: jest.fn().mockResolvedValue(undefined),
            updateMeeting: jest.fn().mockResolvedValue(undefined),
            getMeeting: jest.fn(),
            isScopeError: jest.fn().mockReturnValue(false),
        };

        queryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                create: jest.fn((entity, data) => ({ ...data, id: 'gen-id-' + Math.random() })),
                save: jest.fn(async (entity) => entity),
                update: jest.fn().mockResolvedValue(undefined),
                delete: jest.fn().mockResolvedValue(undefined),
                count: jest.fn().mockResolvedValue(0),
            },
        };

        dataSource = {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
            getRepository: jest.fn((entity) => {
                if (entity.name === 'ZoomMeeting') return meetingRepo;
                return bookingRepo;
            }),
        };

        eventEmitter = { emit: jest.fn() };
        auditService = { logAsync: jest.fn() };

        service = new ZoomBookingService(
            auditService,
            bookingRepo,
            accountRepo,
            meetingRepo,
            participantRepo,
            settingsRepo,
            auditLogRepo,
            dataSource,
            zoomApi,
            eventEmitter,
        );
    });

    describe('createBooking (Recurring)', () => {
        it('creates a native recurring meeting on Zoom and stores all occurrences with same seriesId', async () => {
            const startDate = futureDate(1);
            const endDate = futureDate(2);

            // No conflicts
            bookingRepo.createQueryBuilder.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
            });

            const result = await service.createBooking(
                {
                    title: 'Daily Standup Recurring',
                    bookingDate: startDate,
                    startTime: '10:00',
                    durationMinutes: 60,
                    recurrencePattern: `FREQ=DAILY;INTERVAL=1;UNTIL=${endDate.replace(/-/g, '')}T235959Z`,
                },
                { userId: 'user-1' }
            );

            expect(Array.isArray(result)).toBe(true);
            const bookings = result as any[];
            expect(bookings.length).toBe(2);

            // Verify Zoom API was called with recurrence
            expect(zoomApi.createMeeting).toHaveBeenCalledWith(
                mockAccount.email,
                'Daily Standup Recurring',
                expect.any(Date),
                60,
                undefined,
                expect.objectContaining({
                    type: 1, // Daily
                    repeat_interval: 1,
                })
            );

            // Verify all bookings share the same seriesId and zoomMeetingId
            const firstSeriesId = bookings[0].seriesId;
            expect(firstSeriesId).toBeDefined();
            expect(bookings[1].seriesId).toBe(firstSeriesId);
            expect(bookings[0].meeting.zoomMeetingId).toBe('888999111');
            expect(bookings[1].meeting.zoomMeetingId).toBe('888999111');
            expect(bookings[0].meeting.joinUrl).toBe('https://zoom.us/j/888999111');
            expect(bookings[1].meeting.joinUrl).toBe('https://zoom.us/j/888999111');

            // Verify occurrences are stored
            expect(bookings[0].meeting.occurrenceId).toBe('occ-1');
            expect(bookings[1].meeting.occurrenceId).toBe('occ-2');
        });

        it('enforces All-or-Nothing validation and throws ConflictException if an account has conflict on any date', async () => {
            const startDate = futureDate(1);
            const endDate = futureDate(2);

            // Conflict count > 0
            bookingRepo.createQueryBuilder.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(1),
            });

            await expect(
                service.createBooking(
                    {
                        title: 'Daily Standup Conflicted',
                        bookingDate: startDate,
                        startTime: '10:00',
                        durationMinutes: 60,
                        recurrencePattern: `FREQ=DAILY;INTERVAL=1;UNTIL=${endDate.replace(/-/g, '')}T235959Z`,
                    },
                    { userId: 'user-1' }
                )
            ).rejects.toThrow(ConflictException);

            // Zoom API should NOT be called
            expect(zoomApi.createMeeting).not.toHaveBeenCalled();
        });
    });

    describe('cancelBooking (Recurring Scope)', () => {
        it('cancels specific occurrence on Zoom when scope is this and other occurrences remain', async () => {
            const primaryBooking = {
                id: 'booking-1',
                title: 'Recurring Standup',
                seriesId: 'series-xyz',
                meeting: {
                    zoomMeetingId: '888999111',
                    occurrenceId: 'occ-1',
                },
                bookedByUserId: 'user-1',
                status: BookingStatus.CONFIRMED,
                bookingDate: new Date(futureDate(1)),
                startTime: '10:00',
                endTime: '11:00',
            };

            bookingRepo.findOne.mockResolvedValue(primaryBooking);
            // Remaining in series after deletion is 1
            bookingRepo.count.mockResolvedValue(1);

            await service.cancelBooking(
                'booking-1',
                { cancellationReason: 'Only cancel today', scope: 'this' },
                { userId: 'user-1', role: 'ADMIN' }
            );

            // Verify occurrence-specific deletion was called on Zoom
            expect(zoomApi.deleteMeeting).toHaveBeenCalledWith('888999111', 'occ-1');
        });

        it('deletes entire Zoom meeting when scope is all', async () => {
            const primaryBooking = {
                id: 'booking-1',
                title: 'Recurring Standup',
                seriesId: 'series-xyz',
                meeting: {
                    zoomMeetingId: '888999111',
                    occurrenceId: 'occ-1',
                },
                bookedByUserId: 'user-1',
                status: BookingStatus.CONFIRMED,
                bookingDate: new Date(futureDate(1)),
                startTime: '10:00',
                endTime: '11:00',
            };

            bookingRepo.findOne.mockResolvedValue(primaryBooking);
            bookingRepo.createQueryBuilder.mockReturnValue({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([
                    {
                        id: 'booking-2',
                        seriesId: 'series-xyz',
                        meeting: { zoomMeetingId: '888999111', occurrenceId: 'occ-2' },
                        status: BookingStatus.CONFIRMED,
                    },
                ]),
            });

            await service.cancelBooking(
                'booking-1',
                { cancellationReason: 'Cancel all series', scope: 'all' },
                { userId: 'user-1', role: 'ADMIN' }
            );

            // When scope is all, deletes whole meeting without occurrenceId
            expect(zoomApi.deleteMeeting).toHaveBeenCalledWith('888999111');
        });
    });

    describe('syncActiveRecurringSeries', () => {
        it('converts legacy type 2 recurring series into native type 8 and updates bookings', async () => {
            const date1 = futureDate(1);
            const date2 = futureDate(2);

            const activeBookings = [
                {
                    id: 'b-1',
                    seriesId: 'series-legacy-1',
                    title: 'Legacy Standup',
                    recurrencePattern: 'FREQ=DAILY;INTERVAL=1;COUNT=2',
                    bookingDate: new Date(date1),
                    startTime: '10:00',
                    durationMinutes: 60,
                    zoomAccount: mockAccount,
                    meeting: { id: 'm-1', zoomMeetingId: 'old-type-2-id', occurrenceId: null },
                },
                {
                    id: 'b-2',
                    seriesId: 'series-legacy-1',
                    title: 'Legacy Standup',
                    recurrencePattern: 'FREQ=DAILY;INTERVAL=1;COUNT=2',
                    bookingDate: new Date(date2),
                    startTime: '10:00',
                    durationMinutes: 60,
                    zoomAccount: mockAccount,
                    meeting: { id: 'm-2', zoomMeetingId: 'old-type-2-id', occurrenceId: null },
                },
            ];

            bookingRepo.find.mockResolvedValue(activeBookings);
            // Old Zoom meeting details: type 2 (single)
            zoomApi.getMeeting.mockResolvedValue({ id: 'old-type-2-id', type: 2 });

            // New Zoom meeting created as type 8
            zoomApi.createMeeting.mockResolvedValue({
                id: 999111222,
                join_url: 'https://zoom.us/j/999111222',
                start_url: 'https://zoom.us/s/999111222',
                password: 'pass',
                host_email: mockAccount.email,
                settings: {},
                occurrences: [
                    { occurrence_id: 'occ-new-1', start_time: `${date1}T07:00:00Z` },
                    { occurrence_id: 'occ-new-2', start_time: `${date2}T07:00:00Z` },
                ],
            });

            const result = await service.syncActiveRecurringSeries();

            expect(result.syncedSeriesCount).toBe(1);
            expect(result.errors).toEqual([]);

            // Verified new type 8 meeting was created
            expect(zoomApi.createMeeting).toHaveBeenCalledWith(
                mockAccount.email,
                'Legacy Standup',
                expect.any(Date),
                60,
                undefined,
                expect.objectContaining({ type: 1 })
            );

            // Verified old meeting deleted
            expect(zoomApi.deleteMeeting).toHaveBeenCalledWith('old-type-2-id');

            // Verified both meetings in DB updated to the new zoomMeetingId and occurrenceIds
            expect(meetingRepo.update).toHaveBeenCalledWith(
                'm-1',
                expect.objectContaining({
                    zoomMeetingId: '999111222',
                    occurrenceId: 'occ-new-1',
                })
            );
            expect(meetingRepo.update).toHaveBeenCalledWith(
                'm-2',
                expect.objectContaining({
                    zoomMeetingId: '999111222',
                    occurrenceId: 'occ-new-2',
                })
            );
        });
    });
});
