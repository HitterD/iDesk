import { validatePasswordPolicy } from './password-policy';

describe('validatePasswordPolicy', () => {
    it('accepts a strong passphrase', () => {
        expect(validatePasswordPolicy('Correct-Horse7!Battery')).toEqual({ valid: true });
    });

    it.each([
        ['shortA1!', 'TOO_SHORT'],
        ['lowercaseonly123', 'MISSING_COMPLEXITY'],
        ['Password123456', 'COMMON_PASSWORD'],
        ['UserName-Secret7!', 'USER_INFO'],
    ])('rejects invalid password (%s)', (password, reason) => {
        expect(validatePasswordPolicy(password, { fullName: 'User Name' })).toMatchObject({ valid: false, reason });
    });

    it('rejects overlong passwords', () => {
        expect(validatePasswordPolicy(`A${'a'.repeat(72)}1!`).reason).toBe('TOO_LONG');
    });
});
