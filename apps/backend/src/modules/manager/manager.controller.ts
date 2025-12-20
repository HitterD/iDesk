import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ManagerDashboardService, ManagerDashboardStats } from './manager-dashboard.service';
import { ManagerReportsService, ManagerReport } from './manager-reports.service';
import { DashboardQueryDto, ReportQueryDto } from './dto';

@ApiTags('Manager')
@ApiBearerAuth()
@Controller('manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.ADMIN)
export class ManagerController {
    constructor(
        private readonly dashboardService: ManagerDashboardService,
        private readonly reportsService: ManagerReportsService,
    ) { }

    // ==========================================
    // Dashboard
    // ==========================================

    @Get('dashboard')
    @ApiOperation({ summary: 'Get manager dashboard statistics' })
    @ApiQuery({ name: 'siteIds', required: false, type: [String], description: 'Filter by site IDs' })
    async getDashboard(@Query() query: DashboardQueryDto): Promise<ManagerDashboardStats> {
        return this.dashboardService.getDashboardStats(query);
    }

    @Get('dashboard/open-tickets')
    @ApiOperation({ summary: 'Get open tickets count by site' })
    async getOpenTicketsBySite(@Query() query: DashboardQueryDto): Promise<{ bySite: Record<string, number> }> {
        const stats = await this.dashboardService.getDashboardStats(query);
        return { bySite: stats.openTickets.bySite };
    }

    @Get('dashboard/top-agents')
    @ApiOperation({ summary: 'Get top performing agents' })
    async getTopAgents(@Query() query: DashboardQueryDto): Promise<ManagerDashboardStats['topAgents']> {
        const stats = await this.dashboardService.getDashboardStats(query);
        return stats.topAgents;
    }

    @Get('dashboard/trend')
    @ApiOperation({ summary: 'Get ticket trend data' })
    async getTrend(@Query() query: DashboardQueryDto): Promise<ManagerDashboardStats['trend']> {
        const stats = await this.dashboardService.getDashboardStats(query);
        return stats.trend;
    }

    @Get('dashboard/critical')
    @ApiOperation({ summary: 'Get recent critical tickets' })
    async getCriticalTickets(@Query() query: DashboardQueryDto): Promise<ManagerDashboardStats['recentCritical']> {
        const stats = await this.dashboardService.getDashboardStats(query);
        return stats.recentCritical;
    }

    // ==========================================
    // Reports
    // ==========================================

    @Get('reports')
    @ApiOperation({ summary: 'Generate manager report' })
    async generateReport(@Query() query: ReportQueryDto): Promise<ManagerReport> {
        return this.reportsService.generateReport(query);
    }

    @Get('reports/ticket-stats')
    @ApiOperation({ summary: 'Get ticket statistics for report' })
    async getTicketStats(@Query() query: ReportQueryDto): Promise<ManagerReport['ticketStats']> {
        const report = await this.reportsService.generateReport({
            ...query,
            includeAgentPerformance: false,
            includeSlaMetrics: false,
        });
        return report.ticketStats;
    }

    @Get('reports/agent-performance')
    @ApiOperation({ summary: 'Get agent performance report' })
    async getAgentPerformance(@Query() query: ReportQueryDto): Promise<ManagerReport['agentPerformance']> {
        const report = await this.reportsService.generateReport({
            ...query,
            includeTicketStats: false,
            includeSlaMetrics: false,
        });
        return report.agentPerformance;
    }

    @Get('reports/sla-metrics')
    @ApiOperation({ summary: 'Get SLA metrics report' })
    async getSlaMetrics(@Query() query: ReportQueryDto): Promise<ManagerReport['slaMetrics']> {
        const report = await this.reportsService.generateReport({
            ...query,
            includeTicketStats: false,
            includeAgentPerformance: false,
        });
        return report.slaMetrics;
    }

    @Get('reports/site-comparison')
    @ApiOperation({ summary: 'Get site comparison report' })
    async getSiteComparison(@Query() query: ReportQueryDto): Promise<ManagerReport['siteComparison']> {
        const report = await this.reportsService.generateReport({
            ...query,
            reportType: 'COMPARISON' as any,
        });
        return report.siteComparison;
    }
}
