import { redactRaters, redactRespondents } from './csi-read-only.util';

describe('csi-read-only.util', () => {
    it('redactRaters hides identity but keeps the answered flag (for counts)', () => {
        const [row] = redactRaters([{ userId: 'u1', answered: true, user: { id: 'u1', fullName: 'BUDI', email: 'b@x.id', jobTitle: 'Staff' } }]);
        expect(JSON.stringify(row)).not.toMatch(/BUDI|b@x\.id|u1/);
        expect(row.answered).toBe(true);
    });

    it('redactRespondents empties the named lists but keeps totals and department counts', () => {
        const result = redactRespondents({
            mode: 'LISTED', submitted: [{ respondentName: 'BUDI' }], pending: [{ fullName: 'SITI' }],
            pendingByDepartment: [{ department: 'PROD', pending: 1, total: 2 }], totals: { submitted: 1, pending: 1 },
        });
        expect(JSON.stringify(result)).not.toMatch(/BUDI|SITI/);
        expect(result.totals).toEqual({ submitted: 1, pending: 1 });
        expect(result.pendingByDepartment).toHaveLength(1);
    });

    it('redactRespondents keeps pending null for OPEN surveys', () => {
        expect(redactRespondents({ submitted: [], pending: null }).pending).toBeNull();
    });
});
