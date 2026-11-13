import { ConflictException } from '@nestjs/common';
import { BookingStatus } from '../../enums/booking-status.enum';
import { ZoomBookingService } from '../zoom-booking.service';

describe('ZoomBookingService.rescheduleBooking', () => {
    const primaryBooking = {
        id: 'booking-qc',
        zoomAccountId: 'acc-4',
        bookedByUserId: 'user-1',
        title: 'Presentasi Project Development QC',
        bookingDate: '2026-11-13',
        startTime: '15:00:00',
        endTime: '17:00:00',
        durationMinutes: 120,
        status: BookingStatus.CONFIRMED,
        meeting: {
            id: 'meeting-qc',
            zoomMeetingId: '999000111',
        },
    };

    let bookingRepo: {
        findOne: jest.Mock;
        find: jest.Mock;
    };
    let queryRunner: {
        connect: jest.Mock;
        startTransaction: jest.Mock;
        commitTransaction: jest.Mock;
        rollbackTransaction: jest.Mock;
        release: jest.Mock;
        manager: {
            update: jest.Mock;
            create: jest.Mock;
            save: jest.Mock;
        };
    };
    let zoomApi: {
        updateMeeting: jest.Mock;
        isScopeError: jest.Mock;
    };
    let eventEmitter: { emit: jest.Mock };
    let service: ZoomBookingService;

    beforeEach(() => {
        bookingRepo = {
            findOne: jest.fn().mockResolvedValue(primaryBooking),
            find: jest.fn().mockResolvedValue([]),
        };
        queryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
                update: jest.fn().mockResolvedValue(undefined),
                create: jest.fn((_, data) => data),
                save: jest.fn().mockResolvedValue(undefined),
            },
        };
        zoomApi = {
            updateMeeting: jest.fn().mockResolvedValue(undefined),
            isScopeError: jest.fn().mockReturnValue(false),
        };
        eventEmitter = { emit: jest.fn() };

        service = new ZoomBookingService(
            { logAsync: jest.fn() } as any,
            bookingRepo as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } as any,
            zoomApi as any,
            eventEmitter as any,
        );
    });

    it('allows back-to-back reschedule when an existing booking ends at the new startTime (HH:mm:ss vs HH:mm)', async () => {
        bookingRepo.find.mockResolvedValue([
            {
                id: 'booking-ppic',
                title: 'Weekly Meeting PPIC',
                startTime: '13:00:00',
                endTime: '14:00:00',
            },
            primaryBooking,
        ]);

        await service.rescheduleBooking(
            'booking-qc',
            { bookingDate: '2026-11-13', startTime: '14:00', durationMinutes: 120 },
            { userId: 'user-1' },
        );

        expect(zoomApi.updateMeeting).toHaveBeenCalledWith(
            '999000111',
            { start_time: '2026-11-13T14:00:00', duration: 120, timezone: 'Asia/Jakarta' },
            undefined,
        );
        expect(queryRunner.manager.update).toHaveBeenCalledWith(
            expect.anything(),
            'booking-qc',
            expect.objectContaining({
                startTime: '14:00',
                endTime: '16:00',
                durationMinutes: 120,
            }),
        );
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('allows back-to-back reschedule when an existing booking starts at the new endTime', async () => {
        bookingRepo.find.mockResolvedValue([
            {
                id: 'booking-later',
                title: 'Afternoon Sync',
                startTime: '16:00:00',
                endTime: '17:00:00',
            },
        ]);

        await service.rescheduleBooking(
            'booking-qc',
            { bookingDate: '2026-11-13', startTime: '14:00', durationMinutes: 120 },
            { userId: 'user-1' },
        );

        expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('allows single-digit hour startTime when it does not overlap existing bookings', async () => {
        bookingRepo.find.mockResolvedValue([
            {
                id: 'booking-morning',
                title: 'Morning Standup',
                startTime: '08:00:00',
                endTime: '09:00:00',
            },
            {
                id: 'booking-mid',
                title: 'Midday Review',
                startTime: '10:00:00',
                endTime: '11:00:00',
            },
        ]);

        await service.rescheduleBooking(
            'booking-qc',
            { bookingDate: '2026-11-13', startTime: '9:00', durationMinutes: 60 },
            { userId: 'user-1' },
        );

        expect(zoomApi.updateMeeting).toHaveBeenCalledWith(
            '999000111',
            { start_time: '2026-11-13T09:00:00', duration: 60, timezone: 'Asia/Jakarta' },
            undefined,
        );
        expect(queryRunner.manager.update).toHaveBeenCalledWith(
            expect.anything(),
            'booking-qc',
            expect.objectContaining({
                startTime: '09:00',
                endTime: '10:00',
                durationMinutes: 60,
            }),
        );
    });

    it('throws ConflictException when the new window genuinely overlaps an existing booking', async () => {
        bookingRepo.find.mockResolvedValue([
            {
                id: 'booking-ppic',
                title: 'Weekly Meeting PPIC',
                startTime: '13:00:00',
                endTime: '14:30:00',
            },
        ]);

        await expect(
            service.rescheduleBooking(
                'booking-qc',
                { bookingDate: '2026-11-13', startTime: '14:00', durationMinutes: 120 },
                { userId: 'user-1' },
            ),
        ).rejects.toThrow(ConflictException);
        expect(zoomApi.updateMeeting).not.toHaveBeenCalled();
    });
});
