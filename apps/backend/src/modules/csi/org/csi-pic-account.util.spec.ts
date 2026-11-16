import { buildPicAccountMatcher } from './csi-pic-account.util';

describe('buildPicAccountMatcher', () => {
    it('matches by normalised NIK first, ignoring inactive accounts and leading zero differences', () => {
        const accounts = [
            { id: 'u-old', fullName: 'Sri Supatmi', employeeId: '00003713', isActive: false },
            { id: 'u-active', fullName: 'Sri Supatmi', employeeId: '3713', isActive: true },
        ];
        const matcher = buildPicAccountMatcher(accounts, [{ fullName: 'SRI SUPATMI' }]);
        expect(matcher.inactiveIds.has('u-old')).toBe(true);
        expect(matcher.match({ nik: '00003713', fullName: 'SRI SUPATMI' })).toBe('u-active');
    });

    it('falls back to unique active fullName when NIK is a TPL placeholder or employeeId is blank', () => {
        const accounts = [
            { id: 'u-sri', fullName: 'Sri Supatmi', employeeId: null, isActive: true },
            { id: 'u-dup-1', fullName: 'Budi Santoso', employeeId: null, isActive: true },
            { id: 'u-dup-2', fullName: 'Budi Santoso', employeeId: null, isActive: true },
        ];
        const matcher = buildPicAccountMatcher(accounts, [{ fullName: 'SRI SUPATMI' }, { fullName: 'BUDI SANTOSO' }]);
        expect(matcher.match({ nik: 'TPL-12AB34CD', fullName: 'SRI SUPATMI' })).toBe('u-sri');
        expect(matcher.match({ nik: 'TPL-56EF78GH', fullName: 'BUDI SANTOSO' })).toBeNull();
    });

    it('never assigns the same account twice or guesses when two PICs share a name', () => {
        const accounts = [
            { id: 'u-andi', fullName: 'Andi Wijaya', employeeId: null, isActive: true },
        ];
        const matcher = buildPicAccountMatcher(accounts, [{ fullName: 'ANDI WIJAYA' }, { fullName: 'Andi Wijaya' }]);
        expect(matcher.match({ nik: 'TPL-1', fullName: 'ANDI WIJAYA' })).toBeNull();
    });
});
