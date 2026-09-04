import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BulkAssignTicketsDto } from './bulk-assign.dto';

describe('BulkAssignTicketsDto', () => {
    it('accepts valid payload: up to 100 UUIDs, assigneeId UUID, optional reason', async () => {
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: Array.from({ length: 3 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`),
            assigneeId: '11111111-1111-4111-8111-111111111111',
            reason: 'bulk move',
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('rejects more than 100 ticketIds', async () => {
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`),
            assigneeId: '11111111-1111-4111-8111-111111111111',
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(e => e.property === 'ticketIds')).toBe(true);
    });

    it('rejects duplicate ticketIds', async () => {
        const id = '22222222-2222-4222-8222-222222222222';
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: [id, id],
            assigneeId: '11111111-1111-4111-8111-111111111111',
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects non-UUID ticketIds', async () => {
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: ['not-a-uuid'],
            assigneeId: '11111111-1111-4111-8111-111111111111',
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('requires assigneeId', async () => {
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: ['33333333-3333-4333-8333-333333333333'],
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(e => e.property === 'assigneeId')).toBe(true);
    });

    it('rejects invalid assigneeId UUID', async () => {
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: ['44444444-4444-4444-8444-444444444444'],
            assigneeId: 'not-a-uuid',
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('allows omitting reason (optional)', async () => {
        const dto = plainToInstance(BulkAssignTicketsDto, {
            ticketIds: ['55555555-5555-4555-8555-555555555555'],
            assigneeId: '11111111-1111-4111-8111-111111111111',
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });
});
