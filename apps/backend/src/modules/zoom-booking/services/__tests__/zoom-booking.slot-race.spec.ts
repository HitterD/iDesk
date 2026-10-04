import { ConflictException } from '@nestjs/common';
import { ZoomBookingService, addDaysToDateStr, wibNow } from '../zoom-booking.service';

/**
 * Two requests pick the same free account (outside any transaction), then each creates a
 * Zoom meeting before inserting. The insert must re-check the slot under a per-account+day
 * lock, and undo the Zoom meeting when it lost the race.
 */
describe('ZoomBookingService single booking race', () => {
    const settings = {
        id: 's1', advanceBookingDays: 30, workingDays: [0, 1, 2, 3, 4, 5, 6], blockedDates: [] as string[],
        allowedDurations: [30, 60], maxBookingPerUserPerDay: 5,
    };
    const account = { id: 'acc-1', email: 'zoom1@example.com', name: 'Zoom 1', isActive: true };

    const build = (slotTakenInTx: boolean) => {
        const freeQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null), getCount: jest.fn().mockResolvedValue(0) };
        const txQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(slotTakenInTx ? 1 : 0) };
        const queryRunner = {
            connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
            query: jest.fn().mockResolvedValue([]),
            manager: {
                createQueryBuilder: jest.fn(() => txQb),
                create: jest.fn((_e, data) => ({ ...data, id: 'b-1' })),
                save: jest.fn(async (e) => e),
                count: jest.fn().mockResolvedValue(0),
            },
        };
        const bookingRepo = { createQueryBuilder: jest.fn(() => freeQb), count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
        const zoomApi = {
            isConfigured: () => true,
            createMeeting: jest.fn().mockResolvedValue({ id: 555, join_url: 'j', start_url: 's', password: 'p', host_email: account.email, settings: {} }),
            deleteMeeting: jest.fn().mockResolvedValue(undefined),
        };
        const service = new ZoomBookingService(
            { logAsync: jest.fn() } as any,
            bookingRepo as any,
            { find: jest.fn().mockResolvedValue([account]), findOne: jest.fn().mockResolvedValue(account) } as any,
            { findOne: jest.fn() } as any,
            {} as any,
            { findOne: jest.fn().mockResolvedValue(settings) } as any,
            {} as any,
            { createQueryRunner: () => queryRunner, getRepository: () => bookingRepo } as any,
            zoomApi as any,
            { emit: jest.fn() } as any,
        );
        return { service, queryRunner, zoomApi };
    };

    const dto = () => ({ title: 'Sync', bookingDate: addDaysToDateStr(wibNow().dateStr, 1), startTime: '10:00', durationMinutes: 60 });

    it('locks the account+day and books when the slot is still free', async () => {
        const { service, queryRunner } = build(false);

        await service.createBooking(dto() as any, { userId: 'u-1' });

        expect(queryRunner.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
        expect(queryRunner.query.mock.calls[0][1][0]).toMatch(/^zoom-slot:acc-1:/);
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('rejects and deletes the fresh Zoom meeting when another request took the slot first', async () => {
        const { service, queryRunner, zoomApi } = build(true);

        await expect(service.createBooking(dto() as any, { userId: 'u-1' })).rejects.toBeInstanceOf(ConflictException);

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(zoomApi.deleteMeeting).toHaveBeenCalledWith('555');
    });
});
