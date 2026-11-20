import { redactRaters, redactRespondents } from './csi-read-only.util';

describe('csi-read-only.util', () => {
    it('redactRaters hides identity but keeps the answered flag (for counts)', () => {
        const [row] = redactRaters([{ userId: 'u1', answered: true, user: { id: 'u1', fullName: 'BUDI', email: 'b@x.id', jobTitle: 'Staff' } }]);
        expect(JSON.stringify(row)).not.toMatch(/BUDI|b@x\.id|"u1"/);
        expect(row.answered).toBe(true);
    });

    it('redactRespondents keeps one row per rater with site and status, but no identity', () => {
        const result = redactRespondents({
            mode: 'LISTED',
            submitted: [{ responseId: 'r1', userId: 'u1', respondentName: 'BUDI', accountName: 'budi.s', departmentName: 'PROD', siteId: 'smg', submittedAt: 'x' }],
            pending: [{ userId: 'u2', fullName: 'SITI', department: 'QA', siteId: 'krw' }],
            pendingByDepartment: [{ department: 'PROD', pending: 1, total: 2 }], totals: { submitted: 1, pending: 1 },
        });
        expect(JSON.stringify(result)).not.toMatch(/BUDI|budi\.s|SITI|PROD"\s*,\s*"siteId|"u1"|"u2"|"r1"/);
        expect(result.submitted).toHaveLength(1);
        expect(result.submitted[0].siteId).toBe('smg');
        expect(result.pending).toHaveLength(1);
        expect(result.pending![0].siteId).toBe('krw');
        expect(result.totals).toEqual({ submitted: 1, pending: 1 });
        expect(result.pendingByDepartment).toHaveLength(1);
    });

    it('redactRespondents keeps pending null for OPEN surveys', () => {
        expect(redactRespondents({ submitted: [], pending: null }).pending).toBeNull();
    });
});
