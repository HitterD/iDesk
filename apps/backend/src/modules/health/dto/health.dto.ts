/**
 * Health DTOs - Comprehensive system health data structures
 */

export interface SystemMetrics {
    cpuUsage: number;       // 0-100 percentage
    memoryUsage: number;    // 0-100 percentage
    memoryTotal: number;    // bytes
    memoryFree: number;     // bytes
    diskUsage: number;      // 0-100 percentage
    diskTotal: number;      // bytes
    diskFree: number;       // bytes
    platform: string;
    arch: string;
    nodeVersion: string;
    loadAverage: number[];  // 1, 5, 15 minute load averages
}

export interface InfrastructureStatus {
    database: {
        status: 'connected' | 'disconnected';
        latency: number;  // ms
    };
    redis: {
        status: 'connected' | 'disabled' | 'error';
        latency?: number; // ms
        detail?: RedisDetail;
    };
    websocket: {
        status: 'active' | 'inactive';
        clients: number;
    };
    backup: {
        configured: boolean;
        connected?: boolean;
        lastBackup?: string;
    };
}

export interface ServiceStatus {
    name: string;
    module: string;
    status: 'operational' | 'degraded' | 'down';
    latency: number;      // ms
    lastChecked: string;  // ISO timestamp
    message?: string;     // Error message if down
}

export interface SystemIncident {
    id: string;
    service: string;
    previousStatus: string;
    newStatus: string;
    message: string;
    timestamp: string;
}

export interface DetailedHealthStatus {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    version: string;

    system: SystemMetrics;
    infrastructure: InfrastructureStatus;
    services: ServiceStatus[];
    recentIncidents: SystemIncident[];
}

export interface BasicHealthStatus {
    status: 'ok' | 'error';
    timestamp: string;
    uptime: number;
    database: 'connected' | 'disconnected';
    version: string;
}

export const FAST_INTERVAL_MS = 2_000;
export const SLOW_INTERVAL_MS = 30_000;
export const HISTORY_SIZE = 60;

export interface RedisQueueDepth {
    name: string;
    waiting: number;
    active: number;
    failed: number;
}

export interface RedisDetail {
    usedMemory: number;
    keys: number;
    queues: RedisQueueDepth[];
}

export interface HealthHistory {
    cpu: number[];
    memory: number[];
    dbLatency: number[];
    redisLatency: number[];
}

export interface HealthFastUpdate {
    serverTime: string;
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    memoryFree: number;
    loadAverage: number[];
    database: InfrastructureStatus['database'];
    redis: InfrastructureStatus['redis'];
    websocket: InfrastructureStatus['websocket'];
}

export interface HealthSlowUpdate {
    serverTime: string;
    status: DetailedHealthStatus['status'];
    disk: Pick<SystemMetrics, 'diskUsage' | 'diskTotal' | 'diskFree'>;
    services: ServiceStatus[];
    redisDetail?: RedisDetail;
    backup: InfrastructureStatus['backup'];
}

export interface HealthSnapshot extends DetailedHealthStatus {
    serverTime: string;
    history: HealthHistory;
    sampledAt: { fast: string; slow: string };
    redisDetail?: RedisDetail;
}

