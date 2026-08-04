import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/** Thrown by every operation when Redis is not connected. Callers decide fallback vs fail closed. */
export const REDIS_UNAVAILABLE = 'Redis unavailable';

/** SCAN batch size. Bounded work per round trip; never use KEYS on a shared server. */
const SCAN_COUNT = 100;

export interface RedisHealth {
    status: 'connected' | 'disabled' | 'error';
    latency?: number;
}

/**
 * Single typed Redis connection for the whole application.
 *
 * Availability is derived from the live connection status, never latched: a
 * transient outage must not permanently disable refresh-session security state.
 */
@Injectable()
export class RedisClientService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisClientService.name);
    private client: Redis | null = null;

    /** REDIS_ENABLED, fixed at construction. Distinct from "currently connected". */
    readonly enabled: boolean;

    constructor(private readonly configService: ConfigService) {
        this.enabled = this.configService.get<string>('REDIS_ENABLED') === 'true';
    }

    async onModuleInit(): Promise<void> {
        if (!this.enabled) {
            this.logger.log('REDIS_ENABLED is not true; Redis-backed features are disabled');
            return;
        }

        const host = this.configService.get<string>('REDIS_HOST', 'localhost');
        const port = Number(this.configService.get('REDIS_PORT', 6379));

        this.client = new Redis({
            host,
            port,
            password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            // Keep retrying forever with capped backoff so security state recovers by itself.
            retryStrategy: (attempt: number) => Math.min(attempt * 200, 5_000),
            reconnectOnError: (error: Error) =>
                ['READONLY', 'ECONNRESET', 'ETIMEDOUT'].some((code) => error.message.includes(code)),
        });

        this.client.on('error', (error: Error) => this.logger.error(`Redis error: ${error.message}`));
        this.client.on('ready', () => this.logger.log(`Redis ready at ${host}:${port}`));
        this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting'));
        this.client.on('close', () => this.logger.warn('Redis connection closed'));

        try {
            await this.client.ping();
        } catch {
            this.logger.warn('Initial Redis ping failed; retrying in background');
        }
    }

    async onModuleDestroy(): Promise<void> {
        if (!this.client) return;
        try {
            await this.client.quit();
        } catch {
            this.client.disconnect();
        }
        this.client = null;
    }

    /** True only while a command can actually be served. */
    isReady(): boolean {
        return this.enabled && this.client !== null && this.client.status === 'ready';
    }

    /** Round-trip latency in milliseconds. */
    async ping(): Promise<number> {
        const start = Date.now();
        await this.require().ping();
        return Date.now() - start;
    }

    async get(key: string): Promise<string | null> {
        return this.require().get(key);
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        await this.require().setex(key, ttlSeconds, value);
    }

    async del(...keys: string[]): Promise<number> {
        if (keys.length === 0) return 0;
        return this.require().del(...keys);
    }

    /** Namespace-scoped key listing via SCAN. `pattern` must be prefixed, never `*`. */
    async scan(pattern: string): Promise<string[]> {
        const client = this.require();
        const found: string[] = [];
        let cursor = '0';
        do {
            const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_COUNT);
            cursor = next;
            found.push(...batch);
        } while (cursor !== '0');
        return found;
    }

    /** Deletes a namespace batch at a time. Replaces FLUSHDB, which would wipe other tenants of the DB. */
    async deleteByPattern(pattern: string): Promise<number> {
        const client = this.require();
        let cursor = '0';
        let deleted = 0;
        do {
            const [next, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_COUNT);
            cursor = next;
            if (batch.length > 0) deleted += await client.del(...batch);
        } while (cursor !== '0');
        return deleted;
    }

    async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
        return this.require().eval(script, keys.length, ...keys, ...args);
    }

    /** Never surfaces the driver error message; it can contain connection credentials. */
    async health(): Promise<RedisHealth> {
        if (!this.enabled) return { status: 'disabled' };
        try {
            return { status: 'connected', latency: await this.ping() };
        } catch {
            return { status: 'error' };
        }
    }

    private require(): Redis {
        if (!this.isReady()) throw new Error(REDIS_UNAVAILABLE);
        return this.client as Redis;
    }
}
