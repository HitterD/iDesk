import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientService } from './redis-client.service';

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * Application cache.
 *
 * Two disjoint sets of operations share one Redis connection:
 * - `*Security` methods back authentication state. They fail closed: when Redis is
 *   unavailable they throw, and never read or write the in-memory map.
 * - Every other method is best-effort. When Redis is unavailable they fall back to
 *   the in-memory map (single instance only) and log the degradation.
 *
 * Environment variables: `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`,
 * `REDIS_PASSWORD`, `CACHE_TTL` (seconds, default 300).
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);
    private cache = new Map<string, CacheEntry<any>>();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private fallbackLoggedAt = 0;

    private readonly defaultTtlSeconds: number;

    constructor(
        private readonly configService: ConfigService,
        private readonly redis: RedisClientService,
    ) {
        this.defaultTtlSeconds = parseInt(this.configService.get('CACHE_TTL', '300'), 10);
    }

    onModuleInit(): void {
        // The in-memory map is always the fallback path, so its sweeper always runs.
        this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
        this.logger.log(
            this.redis.enabled
                ? 'CacheService using Redis with in-memory fallback'
                : 'CacheService using in-memory store',
        );
    }

    onModuleDestroy(): void {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.cache.clear();
    }

    // ---------------------------------------------------------------------------
    // Security state: fail closed, never falls back to memory.
    // ---------------------------------------------------------------------------

    async setSecurity<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        this.requireSecurityStore();
        await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    }

    async getSecurity<T>(key: string): Promise<T | null> {
        this.requireSecurityStore();
        const data = await this.redis.get(key);
        return data ? (JSON.parse(data) as T) : null;
    }

    async deleteSecurity(key: string): Promise<void> {
        this.requireSecurityStore();
        await this.redis.del(key);
    }

    async deleteSecurityByPattern(pattern: string): Promise<void> {
        this.requireSecurityStore();
        await this.redis.deleteByPattern(pattern);
    }

    async scanSecurity(pattern: string): Promise<string[]> {
        this.requireSecurityStore();
        return this.redis.scan(pattern);
    }

    async evalSecurity(script: string, keys: string[], args: string[]): Promise<unknown> {
        this.requireSecurityStore();
        return this.redis.eval(script, keys, args);
    }

    /** Security state has no safe degraded mode; callers map this to a service-unavailable response. */
    private requireSecurityStore(): void {
        if (!this.redis.isReady()) throw new Error('Redis security store unavailable');
    }

    // ---------------------------------------------------------------------------
    // Best-effort cache: Redis when ready, in-memory otherwise.
    // ---------------------------------------------------------------------------

    /**
     * Reads through Redis when it is ready, otherwise from the in-memory fallback.
     *
     * There is no synchronous read: a synchronous accessor cannot reach Redis, so it
     * would silently miss every cached entry whenever Redis is the active backend.
     */
    async getAsync<T>(key: string): Promise<T | null> {
        if (this.redis.isReady()) {
            try {
                const data = await this.redis.get(key);
                return data ? (JSON.parse(data) as T) : null;
            } catch (error: any) {
                this.logger.error(`Redis get failed for ${key}: ${error.message}`);
                return null;
            }
        }
        this.logFallback();
        return this.getFromMemory<T>(key);
    }

    private getFromMemory<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlSeconds = this.defaultTtlSeconds): void {
        void this.setAsync(key, value, ttlSeconds);
    }

    async setAsync<T>(key: string, value: T, ttlSeconds = this.defaultTtlSeconds): Promise<void> {
        if (this.redis.isReady()) {
            try {
                await this.redis.set(key, JSON.stringify(value), ttlSeconds);
            } catch (error: any) {
                this.logger.error(`Redis set failed for ${key}: ${error.message}`);
            }
            return;
        }
        this.logFallback();
        this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    del(key: string): boolean {
        void this.delAsync(key);
        return true;
    }

    async delAsync(key: string): Promise<boolean> {
        if (this.redis.isReady()) {
            try {
                await this.redis.del(key);
                return true;
            } catch (error: any) {
                this.logger.error(`Redis del failed for ${key}: ${error.message}`);
                return false;
            }
        }
        return this.cache.delete(key);
    }

    /**
     * Deletes every key in one cache namespace. Uses SCAN, never KEYS, so a large
     * keyspace does not block the server.
     *
     * @throws Error when the pattern is not owned by a declared cache namespace —
     * an unscoped pattern could reach `auth:refresh:*` and log every user out.
     */
    async delByPattern(pattern: string): Promise<number> {
        assertCacheNamespace(pattern);

        if (this.redis.isReady()) {
            try {
                return await this.redis.deleteByPattern(pattern);
            } catch (error: any) {
                this.logger.error(`Redis delByPattern failed for ${pattern}: ${error.message}`);
                return 0;
            }
        }

        const regex = patternToRegExp(pattern);
        let deleted = 0;
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deleted++;
            }
        }
        return deleted;
    }

    /**
     * Clears every declared cache namespace, one namespace at a time.
     *
     * Deliberately not `FLUSHDB`: the database is shared with refresh-session
     * security state, so a flush would invalidate every active session.
     */
    async clear(): Promise<void> {
        if (this.redis.isReady()) {
            for (const namespace of CACHE_NAMESPACES) {
                await this.delByPattern(`${namespace}*`);
            }
            return;
        }
        this.cache.clear();
    }

    async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
        const cached = await this.getAsync<T>(key);
        if (cached !== null) return cached;

        const value = await factory();
        await this.setAsync(key, value, ttlSeconds);
        return value;
    }

    /** Counts only declared cache namespaces; security keys are never enumerated here. */
    async getStats(): Promise<{ size: number; keys: string[]; backend: string }> {
        if (this.redis.isReady()) {
            try {
                const keys: string[] = [];
                for (const namespace of CACHE_NAMESPACES) {
                    keys.push(...(await this.redis.scan(`${namespace}*`)));
                }
                return { size: keys.length, keys: keys.slice(0, 100), backend: 'redis' };
            } catch {
                return { size: 0, keys: [], backend: 'redis-error' };
            }
        }
        return { size: this.cache.size, keys: Array.from(this.cache.keys()), backend: 'memory' };
    }

    /** Redis was expected but is unavailable. Rate-limited to one line per minute. */
    private logFallback(): void {
        if (!this.redis.enabled) return;
        const now = Date.now();
        if (now - this.fallbackLoggedAt < 60_000) return;
        this.fallbackLoggedAt = now;
        this.logger.warn('Redis unavailable; serving non-security cache from in-memory fallback');
    }

    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
}

/**
 * Every cache namespace, with its owner and how it is invalidated.
 *
 * `auth:refresh` is intentionally absent: it is security state, owned by
 * RefreshSessionStore, and must never be reachable from cache clear or stats.
 *
 * | Namespace              | Owner                        | TTL      | Invalidation                          |
 * |------------------------|------------------------------|----------|---------------------------------------|
 * | `dashboard:stats:`     | ticket-stats/query services  | default  | CacheInvalidationService ticket/user   |
 * | `tickets:list:`        | ticket query service         | default  | CacheInvalidationService ticket change |
 * | `ticket:`              | ticket query service         | default  | CacheInvalidationService ticket change |
 * | `ticket-templates:`    | ticket-template service      | default  | service-local invalidateAll            |
 * | `user:`                | users service                | default  | CacheInvalidationService user change   |
 * | `agents:all`           | users service                | default  | CacheInvalidationService user change   |
 * | `perm:`                | permissions service          | 60s      | TTL only                               |
 * | `pageAccess:`          | page-access guard            | default  | TTL, or user permission change         |
 * | `featureAccess:`       | feature-access guard         | default  | TTL only                               |
 * | `accessDenials:`       | page-access guard            | 300s     | TTL (lockout counter)                  |
 * | `accessLockout:`       | page-access guard            | 300s     | TTL (lockout flag)                     |
 * | `kb:article:`          | knowledge-base service       | default  | CacheInvalidationService KB change     |
 * | `kb:articles:`         | knowledge-base service       | default  | CacheInvalidationService KB change     |
 * | `sla:config`           | SLA config service           | default  | CacheInvalidationService SLA change    |
 * | `sla-config:`          | SLA config service           | 60s      | delete on SLA config write             |
 * | `sites:active`         | sites service                | default  | delete on site write                   |
 * | `sounds:`              | sound service                | 60s      | delete-all on sound write              |
 * | `hw-catalog:`          | hardware catalog service     | 60s      | delete on catalog write                |
 * | `settings:scheduling`  | scheduling settings service  | default  | write-through on settings update       |
 * | `manager-dashboard:`   | manager dashboard service    | default  | TTL only                               |
 * | `reports:`             | reports service              | default  | TTL only                               |
 * | `search:`              | search service               | 60s      | TTL only                               |
 * | `suggestions:`         | search service               | 60s      | TTL only                               |
 * | `action-items:`        | notification center          | default  | TTL only                               |
 * | `push:`                | push channel service         | 60-65s   | TTL (dedup/throttle windows)           |
 * | `telegram:linkcode:`   | telegram service             | 300s     | consumed on link, else TTL             |
 */
export const CACHE_NAMESPACES = [
    'dashboard:stats:',
    'tickets:list:',
    'ticket:',
    'ticket-templates:',
    'user:',
    'agents:all',
    'perm:',
    'pageAccess:',
    'featureAccess:',
    'accessDenials:',
    'accessLockout:',
    'kb:article:',
    'kb:articles:',
    'sla:config',
    'sla-config:',
    'sites:active',
    'sounds:',
    'hw-catalog:',
    'settings:scheduling',
    'manager-dashboard:',
    'reports:',
    'search:',
    'suggestions:',
    'action-items:',
    'push:',
    'telegram:linkcode:',
] as const;

/** Namespace holding authentication state. Off-limits to every non-security cache operation. */
export const SECURITY_NAMESPACE = 'auth:refresh';

/** @throws Error when `pattern` does not start with a declared cache namespace. */
export function assertCacheNamespace(pattern: string): void {
    const owned = CACHE_NAMESPACES.some(
        (namespace) => pattern.startsWith(namespace) || `${namespace}*` === pattern,
    );
    if (!owned) {
        throw new Error(`Cache pattern is not in a declared cache namespace: ${pattern}`);
    }
}

/** Glob to RegExp for the in-memory fallback. Escapes every metacharacter except `*`. */
function patternToRegExp(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`);
}

// Cache key builders for consistent key naming
export const CacheKeys = {
    dashboardStats: (userId: string) => `dashboard:stats:${userId}`,
    ticketList: (userId: string, page: number) => `tickets:list:${userId}:${page}`,
    ticketDetail: (ticketId: string) => `ticket:${ticketId}`,
    userProfile: (userId: string) => `user:${userId}`,
    agents: () => `agents:all`,
    slaConfig: () => `sla:config`,
    kbArticles: (page: number) => `kb:articles:${page}`,
    kbArticle: (id: string) => `kb:article:${id}`,
    pageAccess: (userId: string) => `pageAccess:${userId}`,
};
