import { CREATE_INDEXES_SQL, RequestFlowSourceIndexes1794860000000 } from './1794860000000-RequestFlowSourceIndexes';

describe('RequestFlowSourceIndexes1794860000000', () => {
    it('indexes both request columns, idempotently', async () => {
        const query = jest.fn(async (_sql: string) => undefined);
        await new RequestFlowSourceIndexes1794860000000().up({ query } as never);
        expect(query.mock.calls.map(([sql]) => sql)).toEqual([...CREATE_INDEXES_SQL]);
        for (const sql of CREATE_INDEXES_SQL) expect(sql).toContain('IF NOT EXISTS');
    });

    it('never touches an enum or a table shape (it runs inside the shared migration transaction)', () => {
        for (const sql of CREATE_INDEXES_SQL) expect(sql).not.toMatch(/ALTER\s+(TYPE|TABLE)/i);
    });

    it('is registered after the latest migration so it sorts last', () => {
        expect(new RequestFlowSourceIndexes1794860000000().name).toBe('RequestFlowSourceIndexes1794860000000');
    });
});
