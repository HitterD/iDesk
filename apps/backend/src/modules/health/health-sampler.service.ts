import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { HealthService } from './health.service';
import { HealthGateway } from './health.gateway';
import {
    HealthSnapshot,
    HealthFastUpdate,
    HealthSlowUpdate,
    HealthHistory,
    InfrastructureStatus,
    RedisDetail,
    RedisQueueDepth,
    FAST_INTERVAL_MS,
    SLOW_INTERVAL_MS,
    HISTORY_SIZE,
} from './dto/health.dto';

const MONITORED_QUEUES = [
    'notifications',
    'emails',
    'file-processing',
    'reports',
    'zoom-meetings',
    'google-sync',
] as const;

@Injectable()
export class HealthSamplerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(HealthSamplerService.name);
    private readonly redisEnabled: boolean;
    private redisClient: any = null;
    private lastEmittedIncidentId: string | null = null;

    private readonly history: HealthHistory = {
        cpu: [],
        memory: [],
        dbLatency: [],
        redisLatency: [],
    };

    private fastSnapshot: HealthFastUpdate = {
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
        cpuUsage: 0,
        memoryUsage: 0,
        memoryTotal: 0,
        memoryFree: 0,
        loadAverage: [0, 0, 0],
        process: {
            pid: process.pid,
            heapUsed: 0,
            heapTotal: 0,
            rss: 0,
            external: 0,
        },
        database: { status: 'disconnected', latency: 0 },
        redis: { status: 'disabled' },
        websocket: { status: 'active', clients: 0 },
    };

    private slowSnapshot: HealthSlowUpdate = {
        serverTime: new Date().toISOString(),
        status: 'ok',
        disk: { diskUsage: 0, diskTotal: 0, diskFree: 0 },
        services: [],
        backup: { configured: false },
    };

    private sampledAt = {
        fast: new Date().toISOString(),
        slow: new Date().toISOString(),
    };

    constructor(
        @Inject(forwardRef(() => HealthService))
        private readonly healthService: HealthService,
        @Inject(forwardRef(() => HealthGateway))
        private readonly gateway: HealthGateway,
        private readonly configService: ConfigService,
    ) {
        this.redisEnabled = this.configService.get<string>('REDIS_ENABLED') === 'true';
    }

    async onModuleInit(): Promise<void> {
        this.logger.log('Initializing HealthSamplerService');
        await this.createRedisClient().catch((err) =>
            this.logger.warn(`Redis client creation skipped: ${err.message}`)
        );
        void this.refreshFastTier().catch((err) =>
            this.logger.error(`Initial fast tier refresh error: ${err.message}`)
        );
        void this.refreshSlowTier().catch((err) =>
            this.logger.error(`Initial slow tier refresh error: ${err.message}`)
        );
    }

    async onModuleDestroy(): Promise<void> {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch (error) {
                this.logger.warn(`Error closing Redis health client: ${error.message}`);
            }
            this.redisClient = null;
        }
    }

    @Interval(FAST_INTERVAL_MS)
    async scheduledFastRefresh(): Promise<void> {
        await this.refreshFastTier().catch((err) =>
            this.logger.error(`Scheduled fast refresh error: ${err.message}`)
        );
    }

    @Interval(SLOW_INTERVAL_MS)
    async scheduledSlowRefresh(): Promise<void> {
        await this.refreshSlowTier().catch((err) =>
            this.logger.error(`Scheduled slow refresh error: ${err.message}`)
        );
    }

    private async createRedisClient(): Promise<void> {
        if (this.redisClient || !this.redisEnabled) return;

        try {
            const Redis = require('ioredis');
            this.redisClient = new Redis({
                host: this.configService.get<string>('REDIS_HOST', 'localhost'),
                port: this.configService.get<number>('REDIS_PORT', 6379),
                password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
                lazyConnect: false,
                maxRetriesPerRequest: 1,
                connectTimeout: 2_000,
                retryStrategy: (attempt: number) => (attempt > 10 ? null : Math.min(attempt * 100, 3_000)),
            });
            this.redisClient.on('error', (error: Error) =>
                this.logger.warn(`Redis health client error: ${error.message}`)
            );
            await this.redisClient.ping();
        } catch (error) {
            this.logger.warn(`Redis client init failed: ${error.message}`);
        }
    }

    /**
     * Authenticated Redis PING using the sampler's shared client.
     * Never surfaces the underlying error message (may contain connection secrets).
     */
    async pingRedis(): Promise<InfrastructureStatus['redis']> {
        if (!this.redisEnabled) return { status: 'disabled' };
        try {
            if (!this.redisClient) {
                await this.createRedisClient();
                if (!this.redisClient) return { status: 'error' };
            }
            const start = Date.now();
            await this.redisClient.ping();
            return { status: 'connected', latency: Date.now() - start };
        } catch {
            this.logger.warn('Redis PING failed');
            return { status: 'error' };
        }
    }

    private appendHistory(key: keyof HealthHistory, value: number): void {
        const values = this.history[key];
        values.push(value);
        if (values.length > HISTORY_SIZE) {
            values.shift();
        }
    }

    async refreshFastTier(): Promise<void> {
        const [metricsRes, dbRes, redisRes] = await Promise.allSettled([
            this.healthService.getFastSystemMetrics(),
            this.healthService.checkDatabaseHealth(),
            this.pingRedis(),
        ]);

        const serverTime = new Date().toISOString();

        const metrics =
            metricsRes.status === 'fulfilled'
                ? metricsRes.value
                : {
                      cpuUsage: 0,
                      memoryUsage: 0,
                      memoryTotal: 0,
                      memoryFree: 0,
                      platform: osPlatform(),
                      arch: osArch(),
                      nodeVersion: process.version,
                      loadAverage: [0, 0, 0],
                  };

        const database =
            dbRes.status === 'fulfilled'
                ? dbRes.value
                : { status: 'disconnected' as const, latency: 0 };

        const redis =
            redisRes.status === 'fulfilled'
                ? redisRes.value
                : { status: 'error' as const };

        this.appendHistory('cpu', metrics.cpuUsage);
        this.appendHistory('memory', metrics.memoryUsage);
        this.appendHistory('dbLatency', database.latency || 0);
        if (redis.status === 'connected' && redis.latency !== undefined) {
            this.appendHistory('redisLatency', redis.latency);
        }

        this.fastSnapshot = {
            serverTime,
            uptime: process.uptime(),
            cpuUsage: metrics.cpuUsage,
            memoryUsage: metrics.memoryUsage,
            memoryTotal: metrics.memoryTotal,
            memoryFree: metrics.memoryFree,
            loadAverage: metrics.loadAverage,
            process: metrics.process,
            database,
            redis: {
                ...redis,
                detail: this.slowSnapshot.redisDetail,
            },
            websocket: {
                status: 'active',
                clients: (this.healthService as any).wsClientCount || 0,
            },
        };

        this.sampledAt.fast = serverTime;

        this.gateway.pushFast(this.getFastUpdate());
    }

    async refreshSlowTier(): Promise<void> {
        const [diskRes, servicesRes, backupRes, redisDetailRes] = await Promise.allSettled([
            this.healthService.getDiskUsage(),
            this.healthService.getServicesStatus(),
            this.healthService.checkBackupStatus(),
            this.getRedisDetail(),
        ]);

        const serverTime = new Date().toISOString();

        const disk =
            diskRes.status === 'fulfilled'
                ? diskRes.value
                : { diskUsage: 0, diskTotal: 0, diskFree: 0 };

        const services = servicesRes.status === 'fulfilled' ? servicesRes.value : [];

        const backup =
            backupRes.status === 'fulfilled'
                ? backupRes.value
                : { configured: false };

        const redisDetail =
            redisDetailRes.status === 'fulfilled' ? redisDetailRes.value : undefined;

        const status = this.healthService.getOverallStatus(
            {
                database: this.fastSnapshot.database,
                redis: this.fastSnapshot.redis,
                websocket: this.fastSnapshot.websocket,
                backup,
            },
            services
        );

        this.slowSnapshot = {
            serverTime,
            status,
            disk,
            services,
            redisDetail,
            backup,
        };

        this.fastSnapshot.redis.detail = redisDetail;
        this.sampledAt.slow = serverTime;

        this.gateway.pushSlow(this.getSlowUpdate());

        // Emit new incidents
        const incidents = this.healthService.getRecentIncidents(10);
        if (incidents.length > 0) {
            const latest = incidents[0];
            if (latest.id !== this.lastEmittedIncidentId) {
                this.lastEmittedIncidentId = latest.id;
                this.gateway.pushIncident(latest);
            }
        }
    }

    /**
     * Force on-demand full refresh of both fast & slow tiers
     */
    async forceRefresh(): Promise<void> {
        this.logger.log('Executing on-demand health force refresh');
        await Promise.allSettled([
            this.refreshFastTier(),
            this.refreshSlowTier(),
        ]);
    }

    private async getRedisDetail(): Promise<RedisDetail | undefined> {
        if (!this.redisEnabled || !this.redisClient) return undefined;

        try {
            const pipeline = this.redisClient.pipeline();
            pipeline.info('memory');
            pipeline.dbsize();
            for (const name of MONITORED_QUEUES) {
                pipeline.llen(`bull:${name}:wait`);
                pipeline.llen(`bull:${name}:active`);
                pipeline.scard(`bull:${name}:failed`);
            }
            const results = await pipeline.exec();
            if (!results) return undefined;

            const memoryInfo = results[0]?.[1] as string || '';
            const match = memoryInfo.match(/^used_memory:(\d+)$/m);
            const usedMemory = match ? parseInt(match[1], 10) : 0;
            const keys = (results[1]?.[1] as number) || 0;

            const queues: RedisQueueDepth[] = [];
            let resIdx = 2;
            for (const name of MONITORED_QUEUES) {
                const waiting = (results[resIdx]?.[1] as number) || 0;
                const active = (results[resIdx + 1]?.[1] as number) || 0;
                const failed = (results[resIdx + 2]?.[1] as number) || 0;
                queues.push({ name, waiting, active, failed });
                resIdx += 3;
            }

            return { usedMemory, keys, queues };
        } catch (error) {
            this.logger.warn(`Failed to fetch Redis detail: ${error.message}`);
            return undefined;
        }
    }

    getSnapshot(): HealthSnapshot {
        return {
            status: this.slowSnapshot.status,
            timestamp: this.fastSnapshot.serverTime,
            uptime: this.fastSnapshot.uptime,
            version: this.configService.get<string>('APP_VERSION', '1.5.0'),
            system: {
                cpuUsage: this.fastSnapshot.cpuUsage,
                memoryUsage: this.fastSnapshot.memoryUsage,
                memoryTotal: this.fastSnapshot.memoryTotal,
                memoryFree: this.fastSnapshot.memoryFree,
                diskUsage: this.slowSnapshot.disk.diskUsage,
                diskTotal: this.slowSnapshot.disk.diskTotal,
                diskFree: this.slowSnapshot.disk.diskFree,
                platform: osPlatform(),
                arch: osArch(),
                nodeVersion: process.version,
                loadAverage: this.fastSnapshot.loadAverage,
                process: this.fastSnapshot.process,
            },
            infrastructure: {
                database: this.fastSnapshot.database,
                redis: this.fastSnapshot.redis,
                websocket: this.fastSnapshot.websocket,
                backup: this.slowSnapshot.backup,
            },
            services: this.slowSnapshot.services,
            recentIncidents: this.healthService.getRecentIncidents(10),
            serverTime: new Date().toISOString(),
            history: this.getHistory(),
            sampledAt: this.sampledAt,
            redisDetail: this.slowSnapshot.redisDetail,
        };
    }

    getFastUpdate(): HealthFastUpdate {
        return {
            serverTime: this.fastSnapshot.serverTime,
            uptime: this.fastSnapshot.uptime,
            cpuUsage: this.fastSnapshot.cpuUsage,
            memoryUsage: this.fastSnapshot.memoryUsage,
            memoryTotal: this.fastSnapshot.memoryTotal,
            memoryFree: this.fastSnapshot.memoryFree,
            loadAverage: this.fastSnapshot.loadAverage,
            process: this.fastSnapshot.process,
            database: this.fastSnapshot.database,
            redis: this.fastSnapshot.redis,
            websocket: this.fastSnapshot.websocket,
        };
    }

    getSlowUpdate(): HealthSlowUpdate {
        return {
            serverTime: this.slowSnapshot.serverTime,
            status: this.slowSnapshot.status,
            disk: this.slowSnapshot.disk,
            services: this.slowSnapshot.services,
            redisDetail: this.slowSnapshot.redisDetail,
            backup: this.slowSnapshot.backup,
        };
    }

    getHistory(): HealthHistory {
        return {
            cpu: [...this.history.cpu],
            memory: [...this.history.memory],
            dbLatency: [...this.history.dbLatency],
            redisLatency: [...this.history.redisLatency],
        };
    }
}

function osPlatform(): string {
    const os = require('os');
    return os.platform();
}

function osArch(): string {
    const os = require('os');
    return os.arch();
}
