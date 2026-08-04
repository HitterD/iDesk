import { requiresRedisSecurityState, resolveRefreshSessionMode } from './security.config';

describe('resolveRefreshSessionMode', () => {
    it('defaults to legacy when unset', () => {
        expect(resolveRefreshSessionMode(undefined)).toBe('legacy');
    });

    it.each(['legacy', 'dual', 'redis'] as const)('accepts %s', (mode) => {
        expect(resolveRefreshSessionMode(mode)).toBe(mode);
    });

    it('rejects an unknown mode instead of silently falling back', () => {
        expect(() => resolveRefreshSessionMode('memory')).toThrow(/AUTH_REFRESH_SESSION_MODE/);
    });
});

describe('requiresRedisSecurityState', () => {
    it.each([
        ['legacy', false],
        ['dual', true],
        ['redis', true],
    ] as const)('%s -> %s', (mode, expected) => {
        expect(requiresRedisSecurityState(mode)).toBe(expected);
    });
});
