import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface HealthStatus {
    status: 'ok' | 'error';
    timestamp: string;
    uptime: number;
    database: 'connected' | 'disconnected';
    version: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(
        @InjectDataSource()
        private dataSource: DataSource,
    ) {}

    @Get()
    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    @ApiResponse({ status: 503, description: 'Service is unhealthy' })
    async check(): Promise<HealthStatus> {
        let dbStatus: 'connected' | 'disconnected' = 'disconnected';

        try {
            // Check database connection
            await this.dataSource.query('SELECT 1');
            dbStatus = 'connected';
        } catch (error) {
            dbStatus = 'disconnected';
        }

        return {
            status: dbStatus === 'connected' ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbStatus,
            version: process.env.npm_package_version || '1.0.0',
        };
    }

    @Get('live')
    @ApiOperation({ summary: 'Liveness probe' })
    @ApiResponse({ status: 200, description: 'Service is alive' })
    live(): { status: string } {
        return { status: 'alive' };
    }

    @Get('ready')
    @ApiOperation({ summary: 'Readiness probe' })
    @ApiResponse({ status: 200, description: 'Service is ready' })
    @ApiResponse({ status: 503, description: 'Service is not ready' })
    async ready(): Promise<{ status: string; ready: boolean }> {
        try {
            await this.dataSource.query('SELECT 1');
            return { status: 'ready', ready: true };
        } catch (error) {
            return { status: 'not_ready', ready: false };
        }
    }
}
