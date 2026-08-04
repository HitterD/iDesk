import { maskIdentifier, redactSensitive } from './sensitive-data';

describe('maskIdentifier', () => {
    it('keeps a short prefix and suffix', () => {
        expect(maskIdentifier('00000024')).toBe('00***24');
    });

    it('fully masks values too short to partially reveal', () => {
        expect(maskIdentifier('1234')).toBe('***');
    });
});

describe('redactSensitive', () => {
    it('redacts secret fields and masks identifiers', () => {
        expect(redactSensitive({
            nik: '00000024',
            email: 'user@example.com',
            password: 'plaintext',
            refreshToken: 'jwt',
            authorization: 'Bearer x',
            reason: 'WRONG_PASSWORD',
        })).toEqual({
            nik: '00***24',
            email: 'us***om',
            password: '[REDACTED]',
            refreshToken: '[REDACTED]',
            authorization: '[REDACTED]',
            reason: 'WRONG_PASSWORD',
        });
    });

    it('walks nested objects and arrays', () => {
        expect(redactSensitive({ sessions: [{ token: 'a' }], meta: { secret: 'b' } })).toEqual({
            sessions: [{ token: '[REDACTED]' }],
            meta: { secret: '[REDACTED]' },
        });
    });

    it('leaves non-objects untouched', () => {
        const date = new Date('2026-08-03T00:00:00.000Z');
        expect(redactSensitive(date)).toBe(date);
        expect(redactSensitive('plain')).toBe('plain');
    });
});
