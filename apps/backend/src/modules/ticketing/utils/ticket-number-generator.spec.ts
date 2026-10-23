import { generateNextTicketNumber, formatTicketNumber } from './ticket-number-generator';

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
});
