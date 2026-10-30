import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BulkUpdateTicketsDto } from './bulk-update.dto';

describe('BulkUpdateTicketsDto', () => {
    const ticketIds = ['00000000-0000-4000-8000-000000000001'];

    it('accepts a takeover with a reason', async () => {
        const dto = plainToInstance(BulkUpdateTicketsDto, { ticketIds, status: 'IN_PROGRESS', takeover: true, reason: 'PIC cuti' });
        expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects a reason longer than 500 characters', async () => {
        const dto = plainToInstance(BulkUpdateTicketsDto, { ticketIds, takeover: true, reason: 'x'.repeat(501) });
        const errors = await validate(dto);
        expect(errors.some(e => e.property === 'reason')).toBe(true);
    });

    it('strips HTML from the reason', () => {
        const dto = plainToInstance(BulkUpdateTicketsDto, { ticketIds, reason: '<b>PIC</b> cuti<script>x</script>' });
        expect(dto.reason).not.toMatch(/[<>]/);
    });
});
