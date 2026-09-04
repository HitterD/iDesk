import { validatePasswordPolicy } from './password-policy';

describe('validatePasswordPolicy', () => {
    it('accepts a strong passphrase', () => {
        expect(validatePasswordPolicy('Correct-Horse7!Battery')).toEqual({ valid: true });
    });

    it.each([
        ['Ab1!xyz', 'TOO_SHORT'],
        ['lowercaseonly123', 'MISSING_COMPLEXITY'],
        ['Password123456', 'COMMON_PASSWORD'],
        ['UserName-Secret7!', 'USER_INFO'],
    ])('rejects invalid password (%s)', (password, reason) => {
        expect(validatePasswordPolicy(password, { fullName: 'User Name' })).toMatchObject({ valid: false, reason });
    });

    it('accepts 8 character passwords that meet complexity', () => {
        expect(validatePasswordPolicy('Abcdefg1')).toEqual({ valid: true });
    });

    it('rejects 7 character passwords as too short', () => {
        expect(validatePasswordPolicy('Abcdef1')).toMatchObject({ valid: false, reason: 'TOO_SHORT' });
    });

    it('rejects overlong passwords', () => {
        expect(validatePasswordPolicy(`A${'a'.repeat(72)}1!`).reason).toBe('TOO_LONG');
    });
});
