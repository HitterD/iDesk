import { ZoomBookingService } from '../zoom-booking.service';

const futureDate = (days = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

describe('ZoomBookingService.checkAvailability', () => {
    const settings = {
        id: 'settings-1',
        advanceBookingDays: 30,
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        blockedDates: [] as string[],
        allowedDurations: [30, 60, 90, 120],
    };
    const accountRepo = {
        find: jest.fn(),
    };
    const bookingRepo = {
        createQueryBuilder: jest.fn(),
    };
    const settingsRepo = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
    };
    let service: ZoomBookingService;

    beforeEach(() => {
        accountRepo.find.mockResolvedValue([{ id: 'acc-1' }, { id: 'acc-2' }]);
        bookingRepo.createQueryBuilder.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
        });
        settingsRepo.findOne.mockResolvedValue(settings);
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
            { emit: jest.fn() } as any,
        );
    });

    it('returns available when an active account has no conflict', async () => {
        const result = await service.checkAvailability(futureDate(), '10:00', 60);

        expect(result).toEqual({ available: true });
    });

    it('returns unavailable when every active account has a conflict', async () => {
        bookingRepo.createQueryBuilder.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({ id: 'conflict-1' }),
        });

        const result = await service.checkAvailability(futureDate(), '10:00', 60);

        expect(result).toEqual({
            available: false,
            reason: expect.stringContaining('Semua akun penuh'),
        });
    });

    it('returns unavailable for a blocked date', async () => {
        const date = futureDate();
        settingsRepo.findOne.mockResolvedValue({ ...settings, blockedDates: [date] });

        const result = await service.checkAvailability(date, '10:00', 60);

        expect(result).toEqual({ available: false, reason: `Tanggal ${date} diblokir.` });
    });

    it('returns unavailable for a past date', async () => {
        const result = await service.checkAvailability('2020-01-01', '10:00', 60);

        expect(result).toEqual({ available: false, reason: 'Tanggal 2020-01-01 sudah lewat.' });
    });

    it('returns unavailable when duration is not allowed', async () => {
        const result = await service.checkAvailability(futureDate(), '10:00', 180);

        expect(result).toEqual({
            available: false,
            reason: 'Durasi harus salah satu dari: 30, 60, 90, 120 menit.',
        });
    });
});
