import { Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { generateNextTicketNumber, formatTicketNumber, divisionCode, departmentDivision, withTicketNumberRetry } from './ticket-number-generator';

describe('ticket-number-generator (PROD-19 shared, locked generator)', () => {
    const day = new Date(2026, 8, 2, 10, 0);

    function makeManager(maxSeq: string | null) {
        const query = jest.fn(async (sql: string, _params?: unknown[]) => (sql.includes('MAX(') ? [{ maxSeq }] : []));
        return { manager: { query } as any, query };
    }

    it('takes the day advisory lock before reading the sequence', async () => {
        const { manager, query } = makeManager(null);
        await generateNextTicketNumber(manager, 'GEN', day);

        expect(query.mock.calls[0]).toEqual(['SELECT pg_advisory_xact_lock(hashtext($1))', ['ticket-number:020926']]);
        expect(query.mock.calls[1][0]).toContain('MAX(');
        expect(query.mock.calls[1][1]).toEqual(['020926-%']);
    });

    it('returns 0001 when there is no ticket today', async () => {
        expect(await generateNextTicketNumber(makeManager(null).manager, 'GEN', day)).toBe('020926-GEN-0001');
    });

    it('continues the shared daily sequence under the caller division', async () => {
        expect(await generateNextTicketNumber(makeManager('12').manager, 'FIN', day)).toBe('020926-FIN-0013');
    });

    it('reads the tickets table directly, so soft-deleted tickets still hold their number', async () => {
        const { manager, query } = makeManager('11');
        await generateNextTicketNumber(manager, 'FIN', day);

        expect(query.mock.calls[1][0]).not.toMatch(/deletedAt/);
    });

    it('formatTicketNumber pads the sequence to 4 digits', () => {
        expect(formatTicketNumber('020926', 'GEN', 5)).toBe('020926-GEN-0005');
    });

    it('never mints a division with a space or symbol (regression: "261026-HC -0013 already exists")', async () => {
        expect(await generateNextTicketNumber(makeManager('12').manager, 'HC ', day)).toBe('020926-HC-0013');
    });

    it('counts legacy numbers with malformed divisions in the sequence read', async () => {
        const { manager, query } = makeManager(null);
        await generateNextTicketNumber(manager, 'GEN', day);

        expect(query.mock.calls[1][0]).toContain("'^[0-9]{6}-.+-[0-9]+$'");
    });

    describe('divisionCode', () => {
        it.each([
            ['HC Dept', 'HC'],
            ['Finance', 'FIN'],
            ['R&D', 'RD'],
            ['it-support', 'IT'],
            ['  ', 'GEN'],
            ['&&&', 'GEN'],
            [null, 'GEN'],
            [undefined, 'GEN'],
        ])('%p -> %p', (name, expected) => {
            expect(divisionCode(name, 'GEN')).toBe(expected);
        });
    });

    describe('departmentDivision', () => {
        it.each([
            [{ code: 'HCD', name: 'HC Dept' }, 'HCD'],
            [{ code: ' fin ', name: 'Finance' }, 'FIN'],
            [{ code: 'HUMAN CAPITAL', name: 'HC Dept' }, 'HC'],
            [{ code: 'IT-SPJ', name: 'Information Technology' }, 'INF'],
            [{ code: null, name: 'R&D' }, 'RD'],
            [null, 'GEN'],
        ])('%p -> %p', (department, expected) => {
            expect(departmentDivision(department, 'GEN')).toBe(expected);
        });
    });

    describe('withTicketNumberRetry', () => {
        const logger = { error: jest.fn() } as unknown as Logger;
        const violation = (detail: string) =>
            Object.assign(new QueryFailedError('INSERT', [], new Error('dup')), { driverError: { code: '23505', detail } });

        beforeEach(() => (logger.error as jest.Mock).mockClear());

        it('retries once on a ticketNumber collision and logs it as an error', async () => {
            const create = jest.fn()
                .mockRejectedValueOnce(violation('Key ("ticketNumber")=(261026-HC -0013) already exists.'))
                .mockResolvedValueOnce('ok');

            await expect(withTicketNumberRetry(logger, create)).resolves.toBe('ok');
            expect(create).toHaveBeenCalledTimes(2);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('261026-HC -0013'));
        });

        it('gives up after the single retry', async () => {
            const error = violation('Key ("ticketNumber")=(x) already exists.');
            const create = jest.fn().mockRejectedValue(error);

            await expect(withTicketNumberRetry(logger, create)).rejects.toBe(error);
            expect(create).toHaveBeenCalledTimes(2);
        });

        it('does not retry other unique violations or errors', async () => {
            const external = violation('Key ("externalSource", "externalRef")=(ipop, 1) already exists.');
            const create = jest.fn().mockRejectedValue(external);

            await expect(withTicketNumberRetry(logger, create)).rejects.toBe(external);
            expect(create).toHaveBeenCalledTimes(1);
            expect(logger.error).not.toHaveBeenCalled();
        });
    });
});
