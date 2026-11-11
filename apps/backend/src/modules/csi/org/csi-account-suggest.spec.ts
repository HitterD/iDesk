import { nameSimilarity, suggestAccounts, SuggestCandidate } from './csi-account-suggest';

const candidate = (fullName: string, siteId: string | null = null): SuggestCandidate => ({
    id: fullName, fullName, email: `${fullName}@example.test`, employeeId: null, siteId, siteCode: null, department: null,
});

describe('suggestAccounts', () => {
    it('ranks typo above unrelated', () => {
        const result = suggestAccounts('ERNAWATI', ['BUDI', 'ERNAWATI SARI', 'ERNA WATI'].map((name) => candidate(name)), {});
        expect(result.map((row) => row.fullName)).toEqual(['ERNAWATI SARI', 'ERNA WATI']);
        expect(nameSimilarity('ERNAWATI', 'ERNA WATI')).toBe(0.5);
        expect(nameSimilarity('ERNAWATI', 'ERNAWATI')).toBe(1.5);
    });

    it('same site boosts', () => {
        const result = suggestAccounts('ERNAWATI', [candidate('ERNAWATI', 'other'), { ...candidate('ERNAWATI', 'smg'), id: 'local' }], { siteId: 'smg' });
        expect(result[0].id).toBe('local');
        expect(result[0].score - result[1].score).toBeCloseTo(0.15);
        expect(suggestAccounts('ERNAWATI', [candidate('ERNAWATI')], { siteId: null })[0].score).toBe(1.5);
    });

    it('drops weak matches', () => {
        expect(suggestAccounts('ERNAWATI', [candidate('BUDI'), candidate('XYZ')], {})).toEqual([]);
        expect(suggestAccounts('', [candidate('')], {})).toEqual([]);
    });

    it('limit respected and ties sorted by name without mutating input', () => {
        const accounts = Array.from({ length: 10 }, (_, index) => candidate(`ERNAWATI ${9 - index}`));
        expect(suggestAccounts('ERNAWATI', accounts, {})).toHaveLength(8);
        expect(suggestAccounts('ERNAWATI', accounts, { limit: 2 }).map((row) => row.fullName)).toEqual(['ERNAWATI 0', 'ERNAWATI 1']);
        expect(accounts[0].fullName).toBe('ERNAWATI 9');
    });
});
