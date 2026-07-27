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
} from './dto/health.dto';
import { HealthSamplerService } from './health-sampler.service';

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

        return {
            cpuUsage: Math.round(cpuUsage * 100) / 100,
            memoryUsage: Math.round(memUsage * 100) / 100,
            memoryTotal: memTotal,
            memoryFree: memFree,
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            loadAverage: os.loadavg(),
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
     * Check Redis health
     */
    async checkRedisHealth(): Promise<{ status: 'connected' | 'disabled' | 'error'; latency?: number }> {
        const redisActive = this.configService.get('REDIS_ENABLED') === 'true';
        if (!redisActive) {
            return { status: 'disabled' };
        }
        return { status: 'disabled' };
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

    /**
     * Check database health with latency measurement
     */
    async checkDatabaseHealth(): Promise<{ status: 'connected' | 'disconnected'; latency: number }> {
        const start = Date.now();
        try {
            await this.dataSource.query('SELECT 1');
            return {
                status: 'connected',
                latency: Date.now() - start,
            };
        } catch (error) {
            this.logger.error('Database health check failed', error);
            return {
                status: 'disconnected',
                latency: Date.now() - start,
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
                 WHERE status = 'completed' 
                 ORDER BY "createdAt" DESC LIMIT 1`
            );

            return {
                configured: true,
                connected: true,
                lastBackup: lastBackup[0]?.createdAt?.toISOString(),
            };
        } catch (error) {
            // Table might not exist yet
            return { configured: false };
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
}

