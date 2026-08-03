import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBookingDto } from '../booking.dto';

describe('CreateBookingDto', () => {
    it('passes validation without zoomAccountId', async () => {
        const dto = plainToInstance(CreateBookingDto, {
            title: 'Weekly Sync Meeting',
            bookingDate: '2026-08-01',
            startTime: '09:00',
            durationMinutes: 60,
        });

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });

    it('still fails validation without title', async () => {
        const dto = plainToInstance(CreateBookingDto, {
            zoomAccountId: 'acc-1',
            bookingDate: '2026-08-01',
            startTime: '09:00',
            durationMinutes: 60,
        });

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'title')).toBe(true);
    });
});
