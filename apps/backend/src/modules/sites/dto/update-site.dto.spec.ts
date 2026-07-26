import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSiteDto } from './update-site.dto';

describe('UpdateSiteDto', () => {
    it.each(['25:00', '5pm', '7:00'])('rejects invalid closingTime %s', async (closingTime) => {
        const errors = await validate(plainToInstance(UpdateSiteDto, { closingTime }));

        expect(errors.some((error) => error.property === 'closingTime')).toBe(true);
    });

    it.each(['17:00', '09:30'])('accepts valid closingTime %s', async (closingTime) => {
        const errors = await validate(plainToInstance(UpdateSiteDto, { closingTime }));

        expect(errors).toHaveLength(0);
    });

    it('accepts null to clear a configured closing time', async () => {
        const errors = await validate(plainToInstance(UpdateSiteDto, { closingTime: null }));

        expect(errors).toHaveLength(0);
    });
});
