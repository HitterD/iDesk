import { ZoomBookingController } from '../zoom-booking.controller';

describe('ZoomBookingController.getAvailability', () => {
    const bookingService = {
        checkAvailability: jest.fn(),
    };
    const controller = new ZoomBookingController(bookingService as any, {} as any, {} as any);

    beforeEach(() => {
        bookingService.checkAvailability.mockReset();
        bookingService.checkAvailability.mockResolvedValue({ available: true });
    });

    it('delegates valid query params to checkAvailability', async () => {
        const result = await controller.getAvailability('2026-08-01', '10:00', '60');

        expect(bookingService.checkAvailability).toHaveBeenCalledWith('2026-08-01', '10:00', 60);
        expect(result).toEqual({ available: true });
    });

    it.each([
        ['2026-02-30', '10:00', '60'],
        ['2026-08-01', '24:00', '60'],
        ['2026-08-01', '10:00', 'not-a-number'],
        ['2026-08-01', '10:00', '15'],
    ])('rejects invalid availability query: %s %s %s', async (date, startTime, duration) => {
        await expect(controller.getAvailability(date, startTime, duration))
            .rejects.toThrow('Parameter availability tidak valid.');
        expect(bookingService.checkAvailability).not.toHaveBeenCalled();
    });
});

describe('ZoomBookingController.getDaySlotsAvailability', () => {
    const bookingService = {
        getDaySlotsAvailability: jest.fn(),
    };
    const controller = new ZoomBookingController(bookingService as any, {} as any, {} as any);

    beforeEach(() => {
        bookingService.getDaySlotsAvailability.mockReset();
        bookingService.getDaySlotsAvailability.mockResolvedValue({
            date: '2026-09-04',
            availableSlotsCount: 16,
            totalSlotsCount: 20,
            slots: [],
        });
    });

    it('delegates valid query params to getDaySlotsAvailability with default 60 mins', async () => {
        const result = await controller.getDaySlotsAvailability('2026-09-04');
        expect(bookingService.getDaySlotsAvailability).toHaveBeenCalledWith('2026-09-04', 60);
        expect(result).toEqual(expect.objectContaining({ availableSlotsCount: 16 }));
    });

    it('delegates custom duration to getDaySlotsAvailability', async () => {
        await controller.getDaySlotsAvailability('2026-09-04', '30');
        expect(bookingService.getDaySlotsAvailability).toHaveBeenCalledWith('2026-09-04', 30);
    });

    it('rejects invalid date', async () => {
        await expect(controller.getDaySlotsAvailability('invalid-date'))
            .rejects.toThrow('Parameter date tidak valid');
    });
});
