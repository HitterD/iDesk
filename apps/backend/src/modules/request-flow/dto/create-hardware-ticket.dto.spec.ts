import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HardwareTicketItemDto } from './create-hardware-ticket.dto';

const check = async (over: Record<string, unknown>) => {
    const dto = plainToInstance(HardwareTicketItemDto, { manualName: 'Mouse', quantity: 1, ...over });
    return (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length === 0;
};

describe('HardwareTicketItemDto', () => {
    it('accepts replacesName: the create form lets the requester swap an item', async () => {
        expect(await check({ replacesName: 'Mouse lama' })).toBe(true);
    });

    it('rejects an empty replacesName', async () => {
        expect(await check({ replacesName: '' })).toBe(false);
    });
});
