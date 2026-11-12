import { describe, expect, it } from 'vitest';
import { VALID_SITES, validateRow } from '../importUsersValidation';

const row = (siteCode: string) => ({ email: 'a@x.co', fullName: 'Ana', role: 'USER', siteCode });

describe('import users validation', () => {
    it('accepts every site code, Sukodono (SKD) included', () => {
        expect(VALID_SITES).toEqual(['SPJ', 'KRW', 'SKD', 'SMG', 'JTB']);
        expect(validateRow(row('skd')).warnings).toEqual([]);
        expect(validateRow(row('SKD')).isValid).toBe(true);
    });

    it('warns about unknown site codes', () => {
        expect(validateRow(row('XYZ')).warnings).toEqual(['Unknown site: XYZ']);
    });
});
