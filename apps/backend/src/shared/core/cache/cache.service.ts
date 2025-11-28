import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * Cache Service with Redis support
 * 
 * When REDIS_ENABLED=true, uses Redis for distributed caching
 * When REDIS_ENABLED=false, uses in-memory Map (single instance only)
 * 
 * Environment Variables:
 * - REDIS_ENABLED: Set to 'true' to use Redis (default: false)
 * - REDIS_HOST: Redis server host (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - CACHE_TTL: Default TTL in seconds (default: 300)
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CacheService.name);
    private cache = new Map<string, CacheEntry<any>>();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private redisClient: any = null;
    private useRedis: boolean = false;
    
    // Default TTL: 5 minutes
    private readonly defaultTtl: number;

    constructor(private configService: ConfigService) {
        this.defaultTtl = parseInt(this.configService.get('CACHE_TTL', '300'), 10) * 1000;
        this.useRedis = this.configService.get('REDIS_ENABLED') === 'true';
    }

    async onModuleInit() {
        if (this.useRedis) {
            try {
                const Redis = require('ioredis');
                const host = this.configService.get<string>('REDIS_HOST', 'localhost');
                const port = this.configService.get<number>('REDIS_PORT', 6379);
                const password = this.configService.get<string>('REDIS_PASSWORD');
                
                this.redisClient = new Redis({
                    host,
                    port,
                    password: password || undefined,
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 3,
                });
                
                // Test connection
                await this.redisClient.ping();
                this.logger.log(`✅ CacheService connected to Redis at ${host}:${port}`);
            } catch (error: any) {
                this.logger.warn(`⚠️ Redis connection failed: ${error.message}. Falling back to in-memory cache.`);
                this.useRedis = false;
                this.redisClient = null;
            }
        }
        
        if (!this.useRedis) {
            // Cleanup expired entries every minute for in-memory cache
            this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
            this.logger.log('CacheService initialized with in-memory store');
        }
    }

    async onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        this.cache.clear();
    }

    /**
     * Get value from cache
     */
    get<T>(key: string): T | null {
        // For Redis, we need async but maintain sync interface for compatibility
        // Use getAsync for async Redis operations
        if (this.useRedis && this.redisClient) {
            // Return null here, use getAsync for Redis
            return null;
        }
        
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Get value from cache (async - supports Redis)
     */
    async getAsync<T>(key: string): Promise<T | null> {
        if (this.useRedis && this.redisClient) {
            try {
                const data = await this.redisClient.get(key);
                if (!data) return null;
                return JSON.parse(data) as T;
            } catch (error) {
                this.logger.error(`Redis get error for key ${key}:`, error);
                return null;
            }
        }
        return this.get<T>(key);
    }

    /**
     * Set value in cache with optional TTL (in seconds)
     */
    set<T>(key: string, value: T, ttlSeconds?: number): void {
        const ttl = ttlSeconds || Math.floor(this.defaultTtl / 1000);
        
        if (this.useRedis && this.redisClient) {
            // Fire and forget for sync interface
            this.redisClient.setex(key, ttl, JSON.stringify(value)).catch((err: any) => {
                this.logger.error(`Redis set error for key ${key}:`, err);
            });
            return;
        }
        
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttl * 1000),
        });
    }

    /**
     * Set value in cache (async - supports Redis)
     */
    async setAsync<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const ttl = ttlSeconds || Math.floor(this.defaultTtl / 1000);
        
        if (this.useRedis && this.redisClient) {
            try {
                await this.redisClient.setex(key, ttl, JSON.stringify(value));
            } catch (error) {
                this.logger.error(`Redis setAsync error for key ${key}:`, error);
            }
            return;
        }
        
        this.set(key, value, ttlSeconds);
    }

    /**
     * Delete a specific key
     */
    del(key: string): boolean {
        if (this.useRedis && this.redisClient) {
            this.redisClient.del(key).catch((err: any) => {
                this.logger.error(`Redis del error for key ${key}:`, err);
            });
            return true;
        }
        return this.cache.delete(key);
    }

    /**
     * Delete a specific key (async)
     */
    async delAsync(key: string): Promise<boolean> {
        if (this.useRedis && this.redisClient) {
            try {
                await this.redisClient.del(key);
                return true;
            } catch (error) {
                this.logger.error(`Redis delAsync error for key ${key}:`, error);
                return false;
            }
        }
        return this.cache.delete(key);
    }

    /**
     * Delete all keys matching a pattern
     */
    async delByPattern(pattern: string): Promise<number> {
        if (this.useRedis && this.redisClient) {
            try {
                const keys = await this.redisClient.keys(pattern);
                if (keys.length > 0) {
                    await this.redisClient.del(...keys);
                }
                return keys.length;
            } catch (error) {
                this.logger.error(`Redis delByPattern error for pattern ${pattern}:`, error);
                return 0;
            }
        }
        
        const regex = new RegExp(pattern.replace('*', '.*'));
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
     * Clear entire cache
     */
    async clear(): Promise<void> {
        if (this.useRedis && this.redisClient) {
            try {
                await this.redisClient.flushdb();
            } catch (error) {
                this.logger.error('Redis clear error:', error);
            }
            return;
        }
        this.cache.clear();
    }

    /**
     * Get or set - returns cached value or executes factory function
     */
    async getOrSet<T>(
        key: string,
        factory: () => Promise<T>,
        ttlSeconds?: number
    ): Promise<T> {
        const cached = await this.getAsync<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await factory();
        await this.setAsync(key, value, ttlSeconds);
        return value;
    }

    /**
     * Get cache stats
     */
    async getStats(): Promise<{ size: number; keys: string[]; backend: string }> {
        if (this.useRedis && this.redisClient) {
            try {
                const keys = await this.redisClient.keys('*');
                return {
                    size: keys.length,
                    keys: keys.slice(0, 100), // Limit keys returned
                    backend: 'redis',
                };
            } catch (error) {
                return { size: 0, keys: [], backend: 'redis-error' };
            }
        }
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            backend: 'memory',
        };
    }

    /**
     * Cleanup expired entries (only for in-memory cache)
     */
    private cleanup(): void {
        if (this.useRedis) return; // Redis handles TTL automatically
        
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
        }
    }
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
};
