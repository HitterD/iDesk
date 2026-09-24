import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
    SystemMetrics,
    InfrastructureStatus,
    ServiceStatus,
    SystemIncident,
    DetailedHealthStatus,
    BasicHealthStatus,
    ReadinessStatus,
} from './dto/health.dto';
import { StorageAnalyticsResponseDto, TableStorageInfo } from './dto/storage-analytics.dto';
import { HealthSamplerService } from './health-sampler.service';
import {
    requiresRedisSecurityState,
    resolveRefreshSessionMode,
} from '../../shared/core/config/security.config';

interface IncidentRecord {
    id: string;
    service: string;
    previousStatus: string;
    newStatus: string;
    message: string;
    timestamp: string;
}

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);

    // In-memory storage for recent incidents (last 50)
    private recentIncidents: IncidentRecord[] = [];
    private readonly MAX_INCIDENTS = 50;

    // Cache for service statuses
    private serviceStatusCache: Map<string, ServiceStatus> = new Map();

    // WebSocket client count (will be set by gateway)
    private wsClientCount = 0;

    // Last health check timestamp
    private lastCheck: Date = new Date();

    // Services to monitor
    private readonly monitoredServices = [
        { name: 'Authentication', module: 'auth' },
        { name: 'Tickets', module: 'ticketing' },
        { name: 'Notifications', module: 'notifications' },
        { name: 'Reports', module: 'reports' },
        { name: 'Knowledge Base', module: 'knowledge-base' },
        { name: 'Automation', module: 'automation' },
        { name: 'Zoom Booking', module: 'zoom-booking' },
        { name: 'Telegram', module: 'telegram' },
        { name: 'Audit Logs', module: 'audit' },
        { name: 'User Management', module: 'users' },
    ];

    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
        private configService: ConfigService,
        @Inject(forwardRef(() => HealthSamplerService))
        private readonly sampler: HealthSamplerService,
    ) { }

    /**
     * Set WebSocket client count (called by HealthGateway)
     */
    setWsClientCount(count: number): void {
        this.wsClientCount = count;
    }

    /**
     * Get basic health status (backward compatible)
     */
    async getBasicHealth(): Promise<BasicHealthStatus> {
        const dbStatus = await this.checkDatabaseHealth();

        return {
            status: dbStatus.status === 'connected' ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbStatus.status,
            version: this.configService.get<string>('APP_VERSION', '1.5.0'),
        };
    }

    /**
     * Get detailed health status with all metrics from sampler snapshot
     */
    async getDetailedHealth(): Promise<DetailedHealthStatus> {
        const { serverTime, history, sampledAt, redisDetail, ...health } = this.sampler.getSnapshot();
        return health;
    }


    /**
     * Get overall status without side effects
     */
    getOverallStatus(
        infrastructure: InfrastructureStatus,
        services: ServiceStatus[],
    ): 'ok' | 'degraded' | 'error' {
        if (infrastructure.database.status === 'disconnected' || services.some(({ status }) => status === 'down')) return 'error';
        return services.some(({ status }) => status === 'degraded') ? 'degraded' : 'ok';
    }

    /**
     * Get fast system metrics (CPU, Memory, OS info - no disk)
     */
    async getFastSystemMetrics(): Promise<Omit<SystemMetrics, 'diskUsage' | 'diskTotal' | 'diskFree'>> {
        const cpuUsage = await this.getCpuUsage();
        const memTotal = os.totalmem();
        const memFree = os.freemem();
        const memUsage = ((memTotal - memFree) / memTotal) * 100;
        const procMem = process.memoryUsage();
        const procMetrics = {
            pid: process.pid,
            heapUsed: procMem.heapUsed,
            heapTotal: procMem.heapTotal,
            rss: procMem.rss,
            external: procMem.external,
        };

        return {
            cpuUsage: Math.round(cpuUsage * 100) / 100,
            memoryUsage: Math.round(memUsage * 100) / 100,
            memoryTotal: memTotal,
            memoryFree: memFree,
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            loadAverage: os.loadavg(),
            process: procMetrics,
        };
    }

    /**
     * Get system metrics (CPU, Memory, Disk)
     */
    async getSystemMetrics(): Promise<SystemMetrics> {
        const fastMetrics = await this.getFastSystemMetrics();
        const diskInfo = await this.getDiskUsage();

        return {
            ...fastMetrics,
            diskUsage: diskInfo.diskUsage,
            diskTotal: diskInfo.diskTotal,
            diskFree: diskInfo.diskFree,
        };
    }

    /**
     * Check Redis health via the sampler's authenticated client.
     * Returns `disabled` only when REDIS_ENABLED is not 'true'.
     */
    async checkRedisHealth(): Promise<InfrastructureStatus['redis']> {
        if (this.configService.get('REDIS_ENABLED') !== 'true') {
            return { status: 'disabled' };
        }
        return this.sampler.pingRedis();
    }

    /**
     * Readiness contract: database is always required; Redis is required only when
     * refresh-session security state lives in Redis (AUTH_REFRESH_SESSION_MODE != legacy).
     */
    async getReadiness(): Promise<ReadinessStatus> {
        const redisRequired = requiresRedisSecurityState(resolveRefreshSessionMode());
        const [db, redis] = await Promise.all([
            this.checkDatabaseHealth(),
            this.checkRedisHealth(),
        ]);

        const dependencies = {
            database: db.status,
            redis: redis.status,
        };
        const ready = db.status === 'connected'
            && (!redisRequired || redis.status === 'connected');

        return { status: ready ? 'ready' : 'not_ready', ready, dependencies };
    }

    /**
     * Get infrastructure status (Database, Redis, WebSocket, Backup)
     */
    async getInfrastructureStatus(): Promise<InfrastructureStatus> {
        const [dbHealth, redisHealth, backupStatus] = await Promise.all([
            this.checkDatabaseHealth(),
            this.checkRedisHealth(),
            this.checkBackupStatus(),
        ]);

        return {
            database: dbHealth,
            redis: redisHealth,
            websocket: {
                status: 'active',
                clients: this.wsClientCount,
            },
            backup: backupStatus,
        };
    }

    /**
     * Get all services status
     */
    async getServicesStatus(): Promise<ServiceStatus[]> {
        const statuses: ServiceStatus[] = [];

        for (const service of this.monitoredServices) {
            const status = await this.checkServiceHealth(service.name, service.module);
            statuses.push(status);

            // Check for status changes and record incidents
            this.checkForIncident(service.name, status);
            this.serviceStatusCache.set(service.name, status);
        }

        return statuses;
    }

    private lastDbErrorLogTime = 0;

    /**
     * Inspect underlying PostgreSQL connection pool metrics
     */
    private getPoolMetrics(): InfrastructureStatus['database']['pool'] {
        try {
            const driver = (this.dataSource as any)?.driver;
            const pool = driver?.master || driver?.pool;
            if (pool && typeof pool.totalCount === 'number') {
                return {
                    total: pool.totalCount,
                    idle: pool.idleCount,
                    waiting: pool.waitingCount,
                    max: pool.options?.max ?? parseInt(process.env.DB_POOL_MAX || '35', 10),
                };
            }
        } catch {
            // Ignore if driver pool is not directly inspectable
        }
        return undefined;
    }

    /**
     * Check database health with latency measurement and connection pool metrics
     */
    async checkDatabaseHealth(): Promise<InfrastructureStatus['database']> {
        const start = Date.now();
        const pool = this.getPoolMetrics();
        try {
            await this.dataSource.query('SELECT 1');
            return {
                status: 'connected',
                latency: Date.now() - start,
                ...(pool ? { pool } : {}),
            };
        } catch (error) {
            const now = Date.now();
            if (now - this.lastDbErrorLogTime > 30000) {
                this.logger.warn(`Database health check failed: ${error?.message || error}`);
                this.lastDbErrorLogTime = now;
            }
            return {
                status: 'disconnected',
                latency: Date.now() - start,
                ...(pool ? { pool } : {}),
            };
        }
    }

    /**
     * Check backup (Synology) status
     */
    async checkBackupStatus(): Promise<{ configured: boolean; connected?: boolean; lastBackup?: string }> {
        try {
            // Check if any backup configuration exists
            const result = await this.dataSource.query(
                'SELECT COUNT(*) as count FROM backup_configurations WHERE "isActive" = true'
            );
            const count = parseInt(result[0]?.count || '0', 10);

            if (count === 0) {
                return { configured: false };
            }

            // Get last backup info
            const lastBackup = await this.dataSource.query(
                `SELECT "createdAt", status FROM backup_history 
                 WHERE status = 'SUCCESS' 
                 ORDER BY "createdAt" DESC LIMIT 1`
            );

            return {
                configured: true,
                connected: true,
                lastBackup: lastBackup[0]?.createdAt ? new Date(lastBackup[0].createdAt).toISOString() : undefined,
            };
        } catch (error) {
            // Table might not exist yet
            return { configured: false };
        }
    }

    /**
     * Check SJA Desktop Notification Hub status
     */
    async checkSjaNotificationHealth(): Promise<InfrastructureStatus['sjaNotification']> {
        const sjaUrl = this.configService.get<string>('SJA_SERVER_URL', 'http://localhost:18302');
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`${sjaUrl}/health`, { signal: controller.signal });
            clearTimeout(timeout);
            const latency = Date.now() - start;

            if (res.ok) {
                let activeDevices = 1;
                let onlineSockets = 1;
                try {
                    const devRes = await fetch(`${sjaUrl}/v1/devices`);
                    if (devRes.ok) {
                        const devices = await devRes.json();
                        activeDevices = Array.isArray(devices) ? devices.filter((d: any) => d.status === 'ACTIVE').length : 1;
                    }
                } catch {
                    // Non-critical
                }

                return {
                    status: 'connected',
                    latency,
                    activeDevices,
                    onlineSockets,
                    authProtocol: 'DPAPI + HMAC-SHA256',
                    hubUrl: sjaUrl,
                };
            }
            return {
                status: 'degraded',
                latency,
                authProtocol: 'DPAPI + HMAC-SHA256',
                hubUrl: sjaUrl,
            };
        } catch {
            return {
                status: 'disconnected',
                latency: Date.now() - start,
                authProtocol: 'DPAPI + HMAC-SHA256',
                hubUrl: sjaUrl,
            };
        }
    }


    /**
     * Check individual service health
     */
    private async checkServiceHealth(serviceName: string, moduleName: string): Promise<ServiceStatus> {
        const start = Date.now();

        try {
            // Perform module-specific health checks
            let isHealthy = true;
            let message: string | undefined;

            switch (moduleName) {
                case 'ticketing':
                    // Check if tickets table is accessible
                    await this.dataSource.query('SELECT 1 FROM tickets LIMIT 1');
                    break;
                case 'auth':
                    // Check if users table is accessible
                    await this.dataSource.query('SELECT 1 FROM users LIMIT 1');
                    break;
                case 'notifications':
                    // Check notifications table
                    await this.dataSource.query('SELECT 1 FROM notifications LIMIT 1');
                    break;
                case 'knowledge-base':
                    // Check knowledge base table
                    await this.dataSource.query('SELECT 1 FROM articles LIMIT 1');
                    break;
                case 'zoom-booking':
                    // Check zoom tables
                    await this.dataSource.query('SELECT 1 FROM zoom_accounts LIMIT 1');
                    break;
                case 'telegram':
                    // Check telegram sessions
                    await this.dataSource.query('SELECT 1 FROM telegram_sessions LIMIT 1');
                    break;
                case 'audit':
                    // Check audit logs
                    await this.dataSource.query('SELECT 1 FROM audit_logs LIMIT 1');
                    break;
                case 'users':
                    // Check users table
                    await this.dataSource.query('SELECT 1 FROM users LIMIT 1');
                    break;
                case 'reports':
                    // Reports service depends on tickets
                    await this.dataSource.query('SELECT 1 FROM tickets LIMIT 1');
                    break;
                case 'automation':
                    // Check automation rules
                    await this.dataSource.query('SELECT 1 FROM workflow_rules LIMIT 1');
                    break;
                default:
                    // Basic database check for unknown modules
                    await this.dataSource.query('SELECT 1');
            }

            const latency = Date.now() - start;

            return {
                name: serviceName,
                module: moduleName,
                status: latency > 1000 ? 'degraded' : 'operational',
                latency,
                lastChecked: new Date().toISOString(),
                message: latency > 1000 ? 'High latency detected' : undefined,
            };
        } catch (error) {
            return {
                name: serviceName,
                module: moduleName,
                status: 'down',
                latency: Date.now() - start,
                lastChecked: new Date().toISOString(),
                message: error.message || 'Service check failed',
            };
        }
    }

    /**
     * Check for status changes and record incidents
     */
    private checkForIncident(serviceName: string, newStatus: ServiceStatus): void {
        const cachedStatus = this.serviceStatusCache.get(serviceName);

        if (cachedStatus && cachedStatus.status !== newStatus.status) {
            const incident: IncidentRecord = {
                id: `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                service: serviceName,
                previousStatus: cachedStatus.status,
                newStatus: newStatus.status,
                message: newStatus.message || `Status changed from ${cachedStatus.status} to ${newStatus.status}`,
                timestamp: new Date().toISOString(),
            };

            this.recentIncidents.unshift(incident);

            // Keep only last N incidents
            if (this.recentIncidents.length > this.MAX_INCIDENTS) {
                this.recentIncidents = this.recentIncidents.slice(0, this.MAX_INCIDENTS);
            }

            this.logger.warn(`Incident recorded: ${serviceName} - ${cachedStatus.status} -> ${newStatus.status}`);
        }
    }

    /**
     * Get CPU usage percentage
     */
    private async getCpuUsage(): Promise<number> {
        return new Promise((resolve) => {
            const cpus = os.cpus();
            const startMeasure = this.cpuAverage();

            setTimeout(() => {
                const endMeasure = this.cpuAverage();
                const idleDifference = endMeasure.idle - startMeasure.idle;
                const totalDifference = endMeasure.total - startMeasure.total;
                const percentageCPU = 100 - Math.floor((100 * idleDifference) / totalDifference);
                resolve(percentageCPU);
            }, 100);
        });
    }

    private cpuAverage(): { idle: number; total: number } {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
            for (const type in cpu.times) {
                totalTick += cpu.times[type as keyof typeof cpu.times];
            }
            totalIdle += cpu.times.idle;
        }

        return {
            idle: totalIdle / cpus.length,
            total: totalTick / cpus.length,
        };
    }

    /**
     * Get recent incidents
     */
    getRecentIncidents(limit = 20): SystemIncident[] {
        return this.recentIncidents.slice(0, limit);
    }

    /**
     * Get disk usage for the application directory using fs.promises.statfs
     */
    async getDiskUsage(): Promise<{ diskUsage: number; diskTotal: number; diskFree: number }> {
        const configuredPath = this.configService.get<string>('UPLOAD_PATH', './uploads');
        const uploadPath = path.resolve(configuredPath);
        const diskPath = fs.existsSync(uploadPath) ? uploadPath : path.parse(process.cwd()).root;

        try {
            const stats = await fs.promises.statfs(diskPath);
            const total = stats.blocks * stats.bsize;
            const free = stats.bavail * stats.bsize;
            return {
                diskUsage: total === 0 ? 0 : Math.round(((total - free) / total) * 10_000) / 100,
                diskTotal: total,
                diskFree: free,
            };
        } catch (error) {
            this.logger.warn(`Could not read disk usage for ${diskPath}: ${error.message}`);
            return { diskUsage: 0, diskTotal: 0, diskFree: 0 };
        }
    }

    /**
     * Get Datadog-style Storage Analytics & Capacity Forecasting
     */
    async getStorageAnalytics(): Promise<StorageAnalyticsResponseDto> {
        const configuredPath = this.configService.get<string>('UPLOAD_PATH', './uploads');
        const uploadPath = path.resolve(configuredPath);
        if (!fs.existsSync(uploadPath)) {
            try {
                fs.mkdirSync(uploadPath, { recursive: true });
            } catch {}
        }
        const diskPath = fs.existsSync(uploadPath) ? uploadPath : path.parse(process.cwd()).root;

        // 1. Vitals
        const diskUsage = await this.getDiskUsage();
        const totalBytes = diskUsage.diskTotal || (500 * 1024 * 1024 * 1024);
        const freeBytes = diskUsage.diskFree || (400 * 1024 * 1024 * 1024);
        const usedBytes = Math.max(0, totalBytes - freeBytes);
        const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 10_000) / 100 : 0;

        // 2. Folder Uploads Breakdown & Mitigation Candidates (Dynamic Scan)
        let attachmentsBytes = 0;
        let uncompressedImageBytes = 0;
        let recentUploadBytes = 0;
        const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
        const byFolder: Record<string, { count: number; sizeBytes: number }> = {};

        const scanDir = (dir: string, category: string) => {
            if (!fs.existsSync(dir)) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    try {
                        if (entry.isDirectory()) {
                            const subCategory = category === 'root' ? entry.name : category;
                            scanDir(fullPath, subCategory);
                        } else if (entry.isFile()) {
                            const stat = fs.statSync(fullPath);
                            const cat = category === 'root' ? 'direct' : category;
                            if (!byFolder[cat]) {
                                byFolder[cat] = { count: 0, sizeBytes: 0 };
                            }
                            byFolder[cat].count++;
                            byFolder[cat].sizeBytes += stat.size;
                            attachmentsBytes += stat.size;

                            if (stat.mtimeMs >= thirtyDaysAgo) {
                                recentUploadBytes += stat.size;
                            }

                            const ext = path.extname(entry.name).toLowerCase();
                            if (['.jpg', '.jpeg', '.png'].includes(ext) && stat.size > 150 * 1024) {
                                uncompressedImageBytes += stat.size;
                            }
                        }
                    } catch {}
                }
            } catch (e: any) {
                this.logger.debug(`Could not scan directory ${dir}: ${e.message}`);
            }
        };

        scanDir(uploadPath, 'root');

        // 3. PostgreSQL Database Breakdown
        let databaseBytes = 0;
        let topTables: TableStorageInfo[] = [];

        try {
            const dbSizeQuery = await this.dataSource.query('SELECT pg_database_size(current_database()) AS db_size');
            if (dbSizeQuery?.[0]?.db_size) {
                databaseBytes = parseInt(dbSizeQuery[0].db_size, 10) || 0;
            }

            const tablesQuery = await this.dataSource.query(`
                SELECT
                    relname AS table_name,
                    pg_total_relation_size(relid) AS total_bytes
                FROM pg_catalog.pg_statio_user_tables
                ORDER BY total_bytes DESC
                LIMIT 6;
            `);

            if (Array.isArray(tablesQuery)) {
                topTables = tablesQuery.map((row: any) => {
                    const b = parseInt(row.total_bytes, 10) || 0;
                    return {
                        tableName: row.table_name,
                        totalBytes: b,
                        prettySize: this.formatBytes(b),
                    };
                });
            }
        } catch (error: any) {
            this.logger.warn(`Could not query database table sizes: ${error.message}`);
        }

        // iDesk app data footprint vs Host OS overhead
        const ideskUsedBytes = attachmentsBytes + databaseBytes;
        const ideskSaturationPercent = totalBytes > 0
            ? Math.round((ideskUsedBytes / totalBytes) * 10_000) / 100
            : 0;
        const systemOverheadBytes = Math.max(0, usedBytes - ideskUsedBytes);

        // 4. Historical Velocity & Growth calculation (Empirical)
        let recentMessagesCount = 0;
        try {
            const recentQuery = await this.dataSource.query(`
                SELECT COUNT(*) AS count
                FROM "ticket_messages"
                WHERE "createdAt" >= NOW() - INTERVAL '30 days';
            `);
            recentMessagesCount = parseInt(recentQuery?.[0]?.count, 10) || 0;
        } catch {}

        // Velocity based on real 30-day uploaded file modifications
        let attachmentVelocity = 0;
        if (recentUploadBytes > 0) {
            attachmentVelocity = Math.round(recentUploadBytes / 30);
        } else if (attachmentsBytes > 0) {
            attachmentVelocity = Math.round(attachmentsBytes / 90);
        }

        // Database velocity based on recent activity (~25KB per ticket message record)
        let dbVelocity = 0;
        if (recentMessagesCount > 0) {
            dbVelocity = Math.round((recentMessagesCount * 25 * 1024) / 30);
        } else if (databaseBytes > 0) {
            dbVelocity = Math.round(databaseBytes / 180);
        }

        // Combine velocities with realistic minimum baseline if data exists
        let growthRateBytesPerDay = attachmentVelocity + dbVelocity;
        if (growthRateBytesPerDay <= 0 && ideskUsedBytes > 0) {
            growthRateBytesPerDay = 250 * 1024; // 250 KB/day minimal baseline
        }
        const growthRateBytesPerMonth = growthRateBytesPerDay * 30;

        // 5. Thresholds & Runway
        const warningThresholdBytes = Math.round(totalBytes * 0.85);
        const criticalThresholdBytes = Math.round(totalBytes * 0.95);

        const bytesToWarning = Math.max(0, warningThresholdBytes - usedBytes);
        const bytesToCritical = Math.max(0, criticalThresholdBytes - usedBytes);

        const daysToWarningThreshold = growthRateBytesPerDay > 0
            ? Math.round(bytesToWarning / growthRateBytesPerDay)
            : null;
        const daysToCriticalThreshold = growthRateBytesPerDay > 0
            ? Math.round(bytesToCritical / growthRateBytesPerDay)
            : null;

        const now = new Date();
        const formatDaysRunway = (days: number | null): string => {
            if (days === null) return 'N/A';
            if (days <= 0) return 'Kapasitas Penuh';
            if (days > 1095) {
                return '> 3 Tahun (Aman)';
            }
            if (days < 30) return `${days} hari`;
            const months = Math.floor(days / 30);
            const remainingDays = days % 30;
            if (months < 12) {
                return remainingDays > 0 ? `${months} bln ${remainingDays} hr` : `${months} bulan`;
            }
            const years = (days / 365).toFixed(1);
            return `${years} tahun`;
        };

        let estimatedWarningDate: string | null = null;
        let estimatedFullDate: string | null = null;

        if (daysToWarningThreshold !== null) {
            if (daysToWarningThreshold > 1095) {
                estimatedWarningDate = new Date(now.getTime() + 1095 * 86_400_000).toISOString();
            } else {
                estimatedWarningDate = new Date(now.getTime() + daysToWarningThreshold * 86_400_000).toISOString();
            }
        }

        if (daysToCriticalThreshold !== null) {
            if (daysToCriticalThreshold > 1095) {
                estimatedFullDate = new Date(now.getTime() + 1095 * 86_400_000).toISOString();
            } else {
                estimatedFullDate = new Date(now.getTime() + daysToCriticalThreshold * 86_400_000).toISOString();
            }
        }

        let runwayStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (daysToCriticalThreshold !== null && daysToCriticalThreshold <= 30) {
            runwayStatus = 'critical';
        } else if ((daysToWarningThreshold !== null && daysToWarningThreshold <= 60) || usagePercent >= 80) {
            runwayStatus = 'warning';
        }

        // 6. Future Projections (Datadog Style)
        const offsets = [-30, -14, 0, 30, 60, 90, 180, 365];
        const projections = offsets.map((offset) => {
            const pointDate = new Date(now.getTime() + offset * 86_400_000);
            const isProjected = offset > 0;

            const historicalGrowth = offset < 0 ? offset * growthRateBytesPerDay : 0;
            const currentBaseline = offset <= 0
                ? Math.max(0, usedBytes + historicalGrowth)
                : Math.min(totalBytes, usedBytes + (offset * growthRateBytesPerDay));

            const highGrowth = offset <= 0
                ? currentBaseline
                : Math.min(totalBytes, usedBytes + Math.round(offset * growthRateBytesPerDay * 1.5));

            const peakGrowth = offset <= 0
                ? currentBaseline
                : Math.min(totalBytes, usedBytes + Math.round(offset * growthRateBytesPerDay * 2.0));

            return {
                timestamp: pointDate.toISOString(),
                dayOffset: offset,
                isProjected,
                baselineUsedBytes: currentBaseline,
                highGrowthUsedBytes: highGrowth,
                peakGrowthUsedBytes: peakGrowth,
                warningThresholdBytes,
                criticalThresholdBytes,
                totalCapacityBytes: totalBytes,
            };
        });

        // 7. Mitigations
        const imageCompressionSavingsBytes = Math.round(uncompressedImageBytes * 0.35);
        const autoCleanupSavingsBytes = Math.round(attachmentsBytes * 0.20);
        const totalPotentialSavingsBytes = imageCompressionSavingsBytes + autoCleanupSavingsBytes;

        return {
            vitals: {
                totalBytes,
                usedBytes,
                freeBytes,
                usagePercent,
                diskPath,
                platform: os.platform(),
                ideskUsedBytes,
                ideskSaturationPercent,
                serverFreeBytes: freeBytes,
                serverTotalBytes: totalBytes,
            },
            breakdown: {
                attachmentsBytes,
                databaseBytes,
                systemOverheadBytes,
                byFolder,
                topTables,
            },
            forecasting: {
                growthRateBytesPerDay,
                growthRateBytesPerMonth,
                daysToWarningThreshold,
                daysToCriticalThreshold,
                estimatedWarningDate,
                estimatedFullDate,
                runwayStatus,
                timeToWarningFormatted: formatDaysRunway(daysToWarningThreshold),
                timeToCriticalFormatted: formatDaysRunway(daysToCriticalThreshold),
            },
            projections,
            mitigations: {
                imageCompressionSavingsBytes,
                autoCleanupSavingsBytes,
                totalPotentialSavingsBytes,
            },
            sampledAt: new Date().toISOString(),
        };
    }

    private formatBytes(bytes?: number): string {
        if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'B');
    }
}

