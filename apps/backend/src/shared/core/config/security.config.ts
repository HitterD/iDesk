export const BCRYPT_ROUNDS = 12;

export type RefreshSessionMode = 'legacy' | 'dual' | 'redis';

const REFRESH_SESSION_MODES: readonly RefreshSessionMode[] = ['legacy', 'dual', 'redis'];

/** Resolves AUTH_REFRESH_SESSION_MODE; an unknown value is a configuration error, not a fallback. */
export function resolveRefreshSessionMode(
    raw = process.env.AUTH_REFRESH_SESSION_MODE,
): RefreshSessionMode {
    if (!raw) return 'legacy';
    if (!REFRESH_SESSION_MODES.includes(raw as RefreshSessionMode)) {
        throw new Error(
            `Invalid AUTH_REFRESH_SESSION_MODE: expected one of ${REFRESH_SESSION_MODES.join('|')}`,
        );
    }
    return raw as RefreshSessionMode;
}

/** True when refresh sessions live in Redis, making Redis a hard readiness dependency. */
export function requiresRedisSecurityState(mode: RefreshSessionMode): boolean {
    return mode !== 'legacy';
}

/**
 * Rejects a refresh-session mode the deployment cannot serve.
 *
 * Redis security state has no in-memory fallback, so a `dual`/`redis` deployment
 * without Redis would accept logins and then fail every refresh. Failing at startup
 * is the only signal an operator can act on.
 *
 * @throws Error when the mode needs Redis but `REDIS_ENABLED` is not `true`.
 */
export function assertRefreshSessionConfig(
    mode: RefreshSessionMode = resolveRefreshSessionMode(),
    redisEnabled: boolean = process.env.REDIS_ENABLED === 'true',
): void {
    if (requiresRedisSecurityState(mode) && !redisEnabled) {
        throw new Error(
            `AUTH_REFRESH_SESSION_MODE=${mode} requires REDIS_ENABLED=true; refresh sessions cannot fall back to memory`,
        );
    }
}
