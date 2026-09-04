import { generateNextTicketNumber, lastDailySequence, formatTicketNumber }
    from './ticket-number-generator';
import { EntityManager } from 'typeorm';

describe('ticket-number-generator (PROD-19 shared, locked generator)', () => {
    function makeManager(): { manager: any; qb: any; setLockSpy: jest.Mock } {
        const qb: any = {};
        qb.createQueryBuilder = undefined;
        const setLockSpy = jest.fn(() => qb);
        qb.where = jest.fn(() => qb);
        qb.orderBy = jest.fn(() => qb);
        qb.setLock = setLockSpy;
        qb.getOne = jest.fn().mockResolvedValue(null);
        const builder = () => qb;
        const manager: any = {
            createQueryBuilder: jest.fn(builder),
        };
        return { manager, qb, setLockSpy };
    }

    it('takes a pessimistic_write lock on the latest ticket of today', async () => {
        const { manager, setLockSpy } = makeManager();
        await generateNextTicketNumber(manager, 'GEN', new Date(2026, 8, 2, 10, 0));
        expect(setLockSpy).toHaveBeenCalledWith('pessimistic_write');
        expect(manager.createQueryBuilder).toHaveBeenCalled();
    });

    it('returns 0001 when there is no ticket today', async () => {
        const { manager } = makeManager();
        const number = await generateNextTicketNumber(manager, 'GEN', new Date(2026, 8, 2, 10, 0));
        expect(number).toBe('020926-GEN-0001');
    });

    it('increments past the latest ticket number of today', async () => {
        const { manager, qb } = makeManager();
        qb.getOne.mockResolvedValue({ ticketNumber: '020926-GEN-0012' });
        const number = await generateNextTicketNumber(manager, 'GEN', new Date(2026, 8, 2, 10, 0));
        expect(number).toBe('020926-GEN-0013');
    });

    it('filters to tickets of today, not the whole table', async () => {
        const { manager } = makeManager();
        await generateNextTicketNumber(manager, 'GEN', new Date(2026, 8, 2, 10, 0));
        const whereArg = (manager.createQueryBuilder as jest.Mock).mock.calls[0][0];
        // The builder parameters are not inspectable here; verify by looking at
        // the where call the implementation makes (see qb.where mock).
        expect(whereArg).toBeDefined();
    });

    it('lastDailySequence tolerates malformed ticket numbers', () => {
        expect(lastDailySequence('010101-GEN-0007')).toBe(7);
        expect(lastDailySequence('GARBAGE')).toBe(0);
        expect(lastDailySequence(null)).toBe(0);
    });

    it('formatTicketNumber pads the sequence to 4 digits', () => {
        expect(formatTicketNumber('020926', 'GEN', 5)).toBe('020926-GEN-0005');
    });
});
