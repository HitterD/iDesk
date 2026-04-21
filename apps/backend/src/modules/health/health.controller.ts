import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HealthService } from './health.service';
import {
    BasicHealthStatus,
    DetailedHealthStatus,
    ServiceStatus,
    SystemMetrics,
    SystemIncident,
} from './dto/health.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    /**
     * Basic health check (backward compatible)
     */
    @Get()
    @ApiOperation({ summary: 'Basic health check endpoint' })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    @ApiResponse({ status: 503, description: 'Service is unhealthy' })
    async check(): Promise<BasicHealthStatus> {
        return this.healthService.getBasicHealth();
    }

    /**
     * Detailed health status with all metrics
     */
    @Get('detailed')
    @ApiOperation({ summary: 'Detailed health status with system metrics' })
    @ApiResponse({ status: 200, description: 'Detailed health information' })
    async getDetailedHealth(): Promise<DetailedHealthStatus> {
        return this.healthService.getDetailedHealth();
    }

    /**
     * System metrics only (CPU, RAM, Disk)
     */
    @Get('metrics')
    @ApiOperation({ summary: 'System performance metrics' })
    @ApiResponse({ status: 200, description: 'System metrics' })
    async getSystemMetrics(): Promise<SystemMetrics> {
        return this.healthService.getSystemMetrics();
    }

    /**
     * Individual service status
     */
    @Get('services')
    @ApiOperation({ summary: 'All services health status' })
    @ApiResponse({ status: 200, description: 'Services status list' })
    async getServicesStatus(): Promise<ServiceStatus[]> {
        return this.healthService.getServicesStatus();
    }

    /**
     * Recent incidents history
     */
    @Get('incidents')
    @ApiOperation({ summary: 'Recent health incidents' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max incidents to return' })
    @ApiResponse({ status: 200, description: 'Recent incidents list' })
    async getIncidents(@Query('limit') limit?: number): Promise<SystemIncident[]> {
        return this.healthService.getRecentIncidents(limit || 20);
    }

    /**
     * Liveness probe for container orchestration
     */
    @Get('live')
    @ApiOperation({ summary: 'Liveness probe' })
    @ApiResponse({ status: 200, description: 'Service is alive' })
    live(): { status: string } {
        return { status: 'alive' };
    }

    /**
     * Readiness probe for container orchestration
     */
    @Get('ready')
    @ApiOperation({ summary: 'Readiness probe' })
    @ApiResponse({ status: 200, description: 'Service is ready' })
    @ApiResponse({ status: 503, description: 'Service is not ready' })
    async ready(): Promise<{ status: string; ready: boolean }> {
        const health = await this.healthService.getBasicHealth();
        const isReady = health.database === 'connected';
        return {
            status: isReady ? 'ready' : 'not_ready',
            ready: isReady,
        };
    }
}
