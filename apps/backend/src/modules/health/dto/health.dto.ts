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
