/**
 * Cutover behaviour of the refresh-session migration.
 *
 * `AUTH_REFRESH_SESSION_MODE` is read once at module load, so each mode needs a fresh
 * module registry rather than a mutated constant. A reset registry also gives
 * `@nestjs/common` a new copy, so exception classes are compared by HTTP status rather
 * than by `instanceof`.
 */
const UNAUTHORIZED = 401;
const UNAVAILABLE = 503;

// One object for every registry copy: `jest.resetModules()` must not hand the service a
// different bcrypt than the one these tests stub.
const mockBcrypt = { compare: jest.fn(), hash: jest.fn() };
jest.mock('bcrypt', () => mockBcrypt);

function authServiceIn(mode: string) {
    jest.resetModules();
    process.env.AUTH_REFRESH_SESSION_MODE = mode;
    process.env.REDIS_ENABLED = 'true';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../application/auth.service').AuthService;
}

/** Status of the rejection, so a reset module registry cannot break the assertion. */
async function rejectionStatus(promise: Promise<unknown>): Promise<number> {
    return promise.then(
        () => -1,
        (error) => (typeof error?.getStatus === 'function' ? error.getStatus() : -1),
    );
}

type Mocks = ReturnType<typeof mocks>;

function mocks() {
    return {
        token: {
            issueRefreshToken: jest.fn().mockReturnValue({
                access_token: 'access.token',
                refresh_token: 'refresh.token',
                tokenId: 'issued-token',
                familyId: 'issued-family',
                expiresIn: '1h',
                refreshExpiresIn: '7d',
                refreshExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
            }),
            verifyRefreshToken: jest.fn(),
        },
        users: {
            update: jest.fn().mockResolvedValue(undefined),
            updatePassword: jest.fn().mockResolvedValue(undefined),
            findById: jest.fn().mockResolvedValue({ ...USER, password: 'hash' }),
            setCurrentRefreshToken: jest.fn().mockResolvedValue(undefined),
            removeRefreshToken: jest.fn().mockResolvedValue(undefined),
            getUserIfRefreshTokenMatches: jest.fn().mockResolvedValue(null),
        },
        audit: { log: jest.fn().mockResolvedValue({}), logAsync: jest.fn() },
        authEvents: { emit: jest.fn() },
        store: {
            create: jest.fn().mockResolvedValue(undefined),
            consume: jest.fn().mockResolvedValue({ status: 'missing' }),
            invalidateFamily: jest.fn().mockResolvedValue(undefined),
            invalidateUserSessions: jest.fn().mockResolvedValue(undefined),
        },
    };
}

function servicesIn(mode: string, m: Mocks) {
    const AuthService = authServiceIn(mode);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SessionService } = require('../application/session.service');
    const session = new SessionService(m.users, m.store);
    return {
        auth: new AuthService(m.users, m.audit, m.token, session, { validate: jest.fn() }, m.authEvents),
        session,
    };
}

function serviceIn(mode: string, m: Mocks) {
    return servicesIn(mode, m).auth;
}

function sessionIn(mode: string, m: Mocks) {
    return servicesIn(mode, m).session;
}

const USER = { id: 'user-1', email: 'u@e.com', role: 'USER', fullName: 'U', isActive: true, mustChangePassword: false };
const ROTATION_CLAIMS = {
    sub: 'user-1',
    tokenId: 'token-1',
    familyId: 'family-1',
    type: 'refresh',
    rememberMe: false,
};

function configureRefreshToken(m: Mocks, claims: Record<string, unknown> = ROTATION_CLAIMS) {
    m.token.verifyRefreshToken.mockReturnValue(claims);
}

function configureLogin(m: Mocks, expiresIn = '1h') {
    m.token.issueRefreshToken.mockReturnValue({
        ...m.token.issueRefreshToken(),
        expiresIn,
    });
}

const originalMode = process.env.AUTH_REFRESH_SESSION_MODE;
const originalRedis = process.env.REDIS_ENABLED;

afterAll(() => {
    process.env.AUTH_REFRESH_SESSION_MODE = originalMode;
    process.env.REDIS_ENABLED = originalRedis;
    jest.resetModules();
});

describe('refresh session cutover — write path per mode', () => {
    it.each([
        ['legacy', false, true],
        ['dual', true, true],
        ['redis', true, false],
    ])('%s writes redis=%s legacy=%s', async (mode, redisWrite, legacyWrite) => {
        const m = mocks();
        configureLogin(m);
        await serviceIn(mode, m).login(USER);

        expect(m.store.create).toHaveBeenCalledTimes(redisWrite ? 1 : 0);
        expect(m.users.setCurrentRefreshToken).toHaveBeenCalledTimes(legacyWrite ? 1 : 0);
    });

    it('stores no raw token in the legacy column path after cutover', async () => {
        const m = mocks();
        configureLogin(m);
        await serviceIn('redis', m).login(USER);
        expect(m.users.setCurrentRefreshToken).not.toHaveBeenCalled();
    });
});

describe('refresh session cutover — read path per mode', () => {
    it('dual honours a legacy token that carries no rotation claims', async () => {
        const m = mocks();
        configureRefreshToken(m, { sub: 'user-1', type: 'refresh', rememberMe: false });
        m.users.getUserIfRefreshTokenMatches.mockResolvedValue(USER);

        await serviceIn('dual', m).refreshToken('legacy.token');

        expect(m.users.getUserIfRefreshTokenMatches).toHaveBeenCalledWith('legacy.token', 'user-1');
        expect(m.store.consume).not.toHaveBeenCalled();
    });

    it('redis refuses a legacy token that carries no rotation claims', async () => {
        const m = mocks();
        configureRefreshToken(m, { sub: 'user-1', type: 'refresh', rememberMe: false });
        const status = await rejectionStatus(serviceIn('redis', m).refreshToken('legacy.token'));

        expect(status).toBe(UNAUTHORIZED);
        expect(m.users.getUserIfRefreshTokenMatches).not.toHaveBeenCalled();
    });

    it('redis reads a rotation token from the store, never from the legacy column', async () => {
        const m = mocks();
        configureRefreshToken(m);
        m.store.consume.mockResolvedValue({ status: 'valid', session: { userId: 'user-1' } });

        await serviceIn('redis', m).refreshToken('rotation.token');

        expect(m.store.consume).toHaveBeenCalledWith('family-1', 'token-1');
        expect(m.users.getUserIfRefreshTokenMatches).not.toHaveBeenCalled();
    });

    it('invalidates the whole family when a token is presented twice', async () => {
        const m = mocks();
        configureRefreshToken(m);
        m.store.consume.mockResolvedValue({ status: 'reused', session: { userId: 'user-1' } });

        const status = await rejectionStatus(serviceIn('redis', m).refreshToken('rotation.token'));

        expect(status).toBe(UNAUTHORIZED);
        expect(m.store.invalidateFamily).toHaveBeenCalledWith('family-1');
    });

    it('rejects a rotation token whose session belongs to another user', async () => {
        const m = mocks();
        configureRefreshToken(m);
        m.store.consume.mockResolvedValue({ status: 'valid', session: { userId: 'someone-else' } });

        const status = await rejectionStatus(serviceIn('redis', m).refreshToken('rotation.token'));

        expect(status).toBe(UNAUTHORIZED);
    });

    it('reports a Redis outage as unavailable, not as an invalid token', async () => {
        const m = mocks();
        configureRefreshToken(m);
        const service = serviceIn('redis', m);
        // Same registry copy the service resolved, so its `instanceof` guard sees this class.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ServiceUnavailableException } = require('@nestjs/common');
        m.store.consume.mockRejectedValue(new ServiceUnavailableException('Refresh session store unavailable'));

        expect(await rejectionStatus(service.refreshToken('rotation.token'))).toBe(UNAVAILABLE);
    });
});

describe('refresh session cutover — invalidation', () => {
    it.each([
        ['legacy', false, true],
        ['dual', true, true],
        ['redis', true, false],
    ])('%s invalidation clears redis=%s legacy=%s', async (mode, redisClear, legacyClear) => {
        const m = mocks();
        await sessionIn(mode, m).invalidateUser('user-1');

        expect(m.store.invalidateUserSessions).toHaveBeenCalledTimes(redisClear ? 1 : 0);
        expect(m.users.removeRefreshToken).toHaveBeenCalledTimes(legacyClear ? 1 : 0);
    });

    it('a password change invalidates existing refresh sessions', async () => {
        const m = mocks();
        m.users.findById.mockResolvedValue({ ...USER, password: 'hash' });
        mockBcrypt.compare.mockResolvedValue(true);
        mockBcrypt.hash.mockResolvedValue('new-hash');

        await serviceIn('redis', m).changePassword('user-1', {
            currentPassword: 'Old-password7!',
            newPassword: 'New-password7!',
        });

        expect(m.store.invalidateUserSessions).toHaveBeenCalledWith('user-1');
    });
});

describe('startup configuration guard', () => {
    it('rejects a Redis-backed mode when Redis is disabled', () => {
        jest.resetModules();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { assertRefreshSessionConfig } = require('../../../shared/core/config/security.config');
        expect(() => assertRefreshSessionConfig('redis', false)).toThrow(/REDIS_ENABLED=true/);
        expect(() => assertRefreshSessionConfig('dual', false)).toThrow(/REDIS_ENABLED=true/);
        expect(() => assertRefreshSessionConfig('legacy', false)).not.toThrow();
        expect(() => assertRefreshSessionConfig('redis', true)).not.toThrow();
    });
});

describe('cutover migrations', () => {
    function queryRunner() {
        const queries: string[] = [];
        return {
            queries,
            query: jest.fn(async (sql: string) => {
                queries.push(sql);
                return sql.includes('COUNT(*)') ? [{ count: 3 }] : undefined;
            }),
        };
    }

    it('preparation migration adds no state and is safe to rerun', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PrepareRefreshSessionCutover1785000000000 } = require('../../../migrations/1785000000000-PrepareRefreshSessionCutover');
        const migration = new PrepareRefreshSessionCutover1785000000000();
        const q = queryRunner();

        await migration.up(q as never);
        await migration.up(q as never);

        expect(q.queries.filter((sql) => sql.includes('ADD COLUMN IF NOT EXISTS'))).toHaveLength(2);
        expect(q.queries.some((sql) => sql.includes('DROP'))).toBe(false);
    });

    it('removal migration does nothing without the explicit drop confirmation', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { RemoveLegacyRefreshTokenColumn1785000001000 } = require('../../../migrations/1785000001000-RemoveLegacyRefreshTokenColumn');
        const migration = new RemoveLegacyRefreshTokenColumn1785000001000();
        const q = queryRunner();
        delete process.env.AUTH_LEGACY_REFRESH_DROP;

        await migration.up(q as never);

        expect(q.query).not.toHaveBeenCalled();
    });

    it('removal migration drops the column once confirmed, and down restores it', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { RemoveLegacyRefreshTokenColumn1785000001000 } = require('../../../migrations/1785000001000-RemoveLegacyRefreshTokenColumn');
        const migration = new RemoveLegacyRefreshTokenColumn1785000001000();
        const q = queryRunner();
        process.env.AUTH_LEGACY_REFRESH_DROP = 'confirmed';

        await migration.up(q as never);
        await migration.down(q as never);
        delete process.env.AUTH_LEGACY_REFRESH_DROP;

        expect(q.queries[0]).toContain('DROP COLUMN IF EXISTS "hashedRefreshToken"');
        expect(q.queries[1]).toContain('ADD COLUMN IF NOT EXISTS "hashedRefreshToken"');
    });
});
