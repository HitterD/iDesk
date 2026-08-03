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
