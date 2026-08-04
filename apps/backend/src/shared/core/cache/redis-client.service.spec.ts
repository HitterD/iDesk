import { CacheService, assertCacheNamespace, CACHE_NAMESPACES } from './cache.service';
import { RedisClientService, REDIS_UNAVAILABLE } from './redis-client.service';

type Stub = { [K in keyof RedisClientService]?: jest.Mock } & { enabled: boolean; isReady: jest.Mock };

function redisStub(overrides: Partial<Stub> = {}): Stub {
    return {
        enabled: true,
        isReady: jest.fn().mockReturnValue(true),
        ping: jest.fn().mockResolvedValue(1),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(1),
        scan: jest.fn().mockResolvedValue([]),
        deleteByPattern: jest.fn().mockResolvedValue(0),
        eval: jest.fn().mockResolvedValue(['missing']),
        ...overrides,
    } as Stub;
}

function cacheWith(redis: Stub): CacheService {
    const config = { get: (_: string, fallback?: unknown) => fallback } as any;
    return new CacheService(config, redis as unknown as RedisClientService);
}

describe('RedisClientService availability', () => {
    it('is not ready when REDIS_ENABLED is not true', () => {
        const config = { get: () => 'false' } as any;
        expect(new RedisClientService(config).isReady()).toBe(false);
    });

    it('reports disabled health without touching a connection', async () => {
        const config = { get: () => 'false' } as any;
        await expect(new RedisClientService(config).health()).resolves.toEqual({ status: 'disabled' });
    });

    it('reports error health instead of leaking the driver message', async () => {
        const config = { get: (key: string) => (key === 'REDIS_ENABLED' ? 'true' : undefined) } as any;
        const service = new RedisClientService(config);
        await expect(service.health()).resolves.toEqual({ status: 'error' });
    });
});

describe('CacheService security operations', () => {
    it.each([
        ['setSecurity', (c: CacheService) => c.setSecurity('auth:refresh:f:t', {}, 60)],
        ['getSecurity', (c: CacheService) => c.getSecurity('auth:refresh:f:t')],
        ['deleteSecurity', (c: CacheService) => c.deleteSecurity('auth:refresh:f:t')],
        ['deleteSecurityByPattern', (c: CacheService) => c.deleteSecurityByPattern('auth:refresh:f:*')],
        ['scanSecurity', (c: CacheService) => c.scanSecurity('auth:refresh:*')],
        ['evalSecurity', (c: CacheService) => c.evalSecurity('return 1', [], [])],
    ])('%s fails closed when Redis is not ready', async (_name, call) => {
        const redis = redisStub({ isReady: jest.fn().mockReturnValue(false) });
        await expect(call(cacheWith(redis))).rejects.toThrow('Redis security store unavailable');
    });

    it('never writes security state to the in-memory fallback', async () => {
        const redis = redisStub({ isReady: jest.fn().mockReturnValue(false) });
        const cache = cacheWith(redis);

        await expect(cache.setSecurity('auth:refresh:f:t', { userId: 'u1' }, 60)).rejects.toThrow();
        // A non-security read of the same key must find nothing: no memory write happened.
        await expect(cache.getAsync('auth:refresh:f:t')).resolves.toBeNull();
    });

    it('recovers as soon as the connection is ready again', async () => {
        const isReady = jest.fn().mockReturnValueOnce(false).mockReturnValue(true);
        const redis = redisStub({ isReady });
        const cache = cacheWith(redis);

        await expect(cache.getSecurity('auth:refresh:f:t')).rejects.toThrow();
        await expect(cache.getSecurity('auth:refresh:f:t')).resolves.toBeNull();
    });
});

describe('CacheService namespace scoping', () => {
    it('rejects a pattern outside every declared cache namespace', () => {
        expect(() => assertCacheNamespace('auth:refresh:*')).toThrow(/not in a declared cache namespace/);
        expect(() => assertCacheNamespace('*')).toThrow(/not in a declared cache namespace/);
    });

    it('accepts the patterns the invalidation service actually uses', () => {
        for (const pattern of ['dashboard:stats:*', 'tickets:list:*', 'kb:articles:*']) {
            expect(() => assertCacheNamespace(pattern)).not.toThrow();
        }
    });

    it('deletes by pattern with SCAN, never KEYS', async () => {
        const redis = redisStub({ deleteByPattern: jest.fn().mockResolvedValue(3) });
        await expect(cacheWith(redis).delByPattern('tickets:list:*')).resolves.toBe(3);
        expect(redis.deleteByPattern).toHaveBeenCalledWith('tickets:list:*');
    });

    it('refuses to delete a security pattern through the cache path', async () => {
        const redis = redisStub();
        await expect(cacheWith(redis).delByPattern('auth:refresh:*')).rejects.toThrow(
            /not in a declared cache namespace/,
        );
        expect(redis.deleteByPattern).not.toHaveBeenCalled();
    });

    it('clears namespace by namespace instead of FLUSHDB', async () => {
        const redis = redisStub();
        await cacheWith(redis).clear();

        expect(redis.deleteByPattern).toHaveBeenCalledTimes(CACHE_NAMESPACES.length);
        for (const namespace of CACHE_NAMESPACES) {
            expect(redis.deleteByPattern).toHaveBeenCalledWith(`${namespace}*`);
        }
        const patterns = redis.deleteByPattern!.mock.calls.map(([p]) => p as string);
        expect(patterns.some((p) => p.startsWith('auth:refresh'))).toBe(false);
    });

    it('reports stats from declared namespaces only', async () => {
        const redis = redisStub({ scan: jest.fn().mockResolvedValue(['ticket:1']) });
        const stats = await cacheWith(redis).getStats();

        expect(stats.backend).toBe('redis');
        expect(redis.scan).toHaveBeenCalledTimes(CACHE_NAMESPACES.length);
        expect(redis.scan).not.toHaveBeenCalledWith('*');
    });
});

describe('CacheService non-security fallback', () => {
    it('serves reads and writes from memory when Redis is down', async () => {
        const redis = redisStub({ isReady: jest.fn().mockReturnValue(false) });
        const cache = cacheWith(redis);

        await cache.setAsync('ticket:1', { id: '1' }, 60);
        await expect(cache.getAsync('ticket:1')).resolves.toEqual({ id: '1' });
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('matches in-memory patterns literally except for the wildcard', async () => {
        const redis = redisStub({ isReady: jest.fn().mockReturnValue(false) });
        const cache = cacheWith(redis);

        await cache.setAsync('ticket:1', 'a', 60);
        await cache.setAsync('ticket-templates:1', 'b', 60);

        expect(await cache.delByPattern('ticket:*')).toBe(1);
        await expect(cache.getAsync('ticket-templates:1')).resolves.toBe('b');
    });

    it('swallows a Redis read failure rather than failing the request', async () => {
        const redis = redisStub({ get: jest.fn().mockRejectedValue(new Error(REDIS_UNAVAILABLE)) });
        await expect(cacheWith(redis).getAsync('ticket:1')).resolves.toBeNull();
    });
});
