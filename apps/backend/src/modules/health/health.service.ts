import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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

interface IncidentRecord {
    id: string;
    service: string;
    previousStatus: string;
    newStatus: string;
    message: string;
    timestamp: string;
}

@Injectable()
export class HealthService implements OnModuleInit {
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
    ) { }

    async onModuleInit() {
        this.logger.log('HealthService initialized - starting health monitoring');
        // Delay first health check to avoid blocking startup
        setTimeout(() => {
            this.performHealthCheck();
        }, 10000); // 10 second delay
    }

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
     * Get detailed health status with all metrics
     */
    async getDetailedHealth(): Promise<DetailedHealthStatus> {
        const [systemMetrics, infrastructure, services] = await Promise.all([
            this.getSystemMetrics(),
            this.getInfrastructureStatus(),
            this.getServicesStatus(),
        ]);

        // Determine overall status
        let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
        const hasErrors = services.some(s => s.status === 'down') ||
            infrastructure.database.status === 'disconnected';
        const hasDegraded = services.some(s => s.status === 'degraded');

        if (hasErrors) {
            overallStatus = 'error';
        } else if (hasDegraded) {
            overallStatus = 'degraded';
        }

        this.lastCheck = new Date();

        return {
            status: overallStatus,
            timestamp: this.lastCheck.toISOString(),
            uptime: process.uptime(),
            version: this.configService.get<string>('APP_VERSION', '1.5.0'),
            system: systemMetrics,
            infrastructure,
            services,
            recentIncidents: this.recentIncidents.slice(0, 10),
        };
    }

    /**
     * Get system metrics (CPU, Memory, Disk)
     */
    async getSystemMetrics(): Promise<SystemMetrics> {
        const cpuUsage = await this.getCpuUsage();
        const memTotal = os.totalmem();
        const memFree = os.freemem();
        const memUsage = ((memTotal - memFree) / memTotal) * 100;

        // Get disk usage for uploads folder
        const diskInfo = await this.getDiskUsage();

        return {
            cpuUsage: Math.round(cpuUsage * 100) / 100,
            memoryUsage: Math.round(memUsage * 100) / 100,
            memoryTotal: memTotal,
            memoryFree: memFree,
            diskUsage: diskInfo.usage,
            diskTotal: diskInfo.total,
            diskFree: diskInfo.free,
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            loadAverage: os.loadavg(),
        };
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
     * Get recent incidents
     */
    getRecentIncidents(limit = 20): SystemIncident[] {
        return this.recentIncidents.slice(0, limit);
    }

    /**
     * Periodic health check (every 30 seconds)
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async performHealthCheck(): Promise<void> {
        try {
            await this.getDetailedHealth();
            this.logger.debug('Health check completed');
        } catch (error) {
            this.logger.error('Health check failed', error);
        }
    }

    // ==================== Private Methods ====================

    /**
     * Check database health with latency measurement
     */
    private async checkDatabaseHealth(): Promise<{ status: 'connected' | 'disconnected'; latency: number }> {
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
     * Check Redis health
     */
    private async checkRedisHealth(): Promise<{ status: 'connected' | 'disabled' | 'error'; latency?: number }> {
        const redisActive = this.configService.get('REDIS_ENABLED') === 'true';

        if (!redisActive) {
            return { status: 'disabled' };
        }

        const start = Date.now();
        try {
            // Try to ping Redis via cache service pattern
            const Redis = require('ioredis');
            const host = this.configService.get<string>('REDIS_HOST', 'localhost');
            const port = this.configService.get<number>('REDIS_PORT', 6379);
            const password = this.configService.get<string>('REDIS_PASSWORD');

            const client = new Redis({
                host,
                port,
                password: password || undefined,
                maxRetriesPerRequest: 1,
                connectTimeout: 2000,
                lazyConnect: true,
            });

            await client.connect();
            await client.ping();
            await client.quit();

            return {
                status: 'connected',
                latency: Date.now() - start,
            };
        } catch (error) {
            return {
                status: 'error',
                latency: Date.now() - start,
            };
        }
    }

    /**
     * Check backup (Synology) status
     */
    private async checkBackupStatus(): Promise<{ configured: boolean; connected?: boolean; lastBackup?: string }> {
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
     * Get disk usage for the application directory
     */
    private async getDiskUsage(): Promise<{ usage: number; total: number; free: number }> {
        try {
            // Use the uploads directory or root
            const uploadPath = this.configService.get('UPLOAD_PATH') || './uploads';
            const absolutePath = path.resolve(uploadPath);

            // For Windows, use different approach
            if (os.platform() === 'win32') {
                const { execSync } = require('child_process');
                const drive = absolutePath.split(':')[0] + ':';

                try {
                    const output = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get Size,FreeSpace /format:csv`, {
                        encoding: 'utf8',
                        timeout: 5000,
                    });

                    const lines = output.trim().split('\n').filter((l: any) => l.trim());
                    if (lines.length >= 2) {
                        const values = lines[1].split(',');
                        const freeSpace = parseInt(values[1] || '0', 10);
                        const totalSize = parseInt(values[2] || '0', 10);

                        if (totalSize > 0) {
                            return {
                                usage: Math.round(((totalSize - freeSpace) / totalSize) * 100 * 100) / 100,
                                total: totalSize,
                                free: freeSpace,
                            };
                        }
                    }
                } catch (e) {
                    // Fallback if wmic fails
                }
            }

            // Fallback - return safe defaults
            return {
                usage: 0,
                total: 0,
                free: 0,
            };
        } catch (error) {
            this.logger.debug('Could not get disk usage', error);
            return {
                usage: 0,
                total: 0,
                free: 0,
            };
        }
    }
}
