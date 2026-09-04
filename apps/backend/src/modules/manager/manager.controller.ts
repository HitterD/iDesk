import { Controller, Get, Post, Query, Body, Res, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { SiteActor } from '../../shared/core/utils/site-scope.util';
import { UserRole } from '../users/enums/user-role.enum';
import { ManagerDashboardService, ManagerDashboardStats } from './manager-dashboard.service';
import { ManagerReportsService, ManagerReport } from './manager-reports.service';
import { ManagerReportExportService } from './manager-report-export.service';
import { DashboardQueryDto, ReportQueryDto, GenerateManagerReportDto } from './dto';

@ApiTags('Manager')
@ApiBearerAuth()
@Controller('manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER, UserRole.ADMIN)
export class ManagerController {
    constructor(
        private readonly dashboardService: ManagerDashboardService,
        private readonly reportsService: ManagerReportsService,
        private readonly reportExportService: ManagerReportExportService,
    ) { }

    // ==========================================
    // Reports — file export (POST /manager/reports/generate)
    // Dipakai ManagerReportsPage: POST body karena payload sections[]
    // bisa panjang + operasi generate mahal tidak boleh auto-retry (Q10).
    // ==========================================

    @Post('reports/generate')
    @ApiOperation({ summary: 'Generate & stream manager report file (PDF/Excel)' })
    async generateReportFile(
        @Res() res: Response,
        @Req() req: Request,
        @Body() dto: GenerateManagerReportDto,
    ): Promise<void> {
        const actor: SiteActor = {
            role: ((req as any).user?.role) as UserRole,
            siteId: (req as any).user?.siteId ?? null,
        };
        const userId = (req as any).user?.id || (req as any).user?.userId;

        return this.reportExportService.stream(res, actor, userId, dto);
    }

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
    // Reports — JSON (GET, jalur lama tetap jalan)
    // ==========================================

    @Get('reports')
    @ApiOperation({ summary: 'Generate manager report (JSON)' })
    async generateReport(@Req() req: Request, @Query() query: ReportQueryDto): Promise<ManagerReport> {
        return this.reportsService.generateReport(query, this.actorFrom(req));
    }

    @Get('reports/ticket-stats')
    @ApiOperation({ summary: 'Get ticket statistics for report' })
    async getTicketStats(@Req() req: Request, @Query() query: ReportQueryDto): Promise<ManagerReport['ticketStats']> {
        const report = await this.reportsService.generateReport(
            { ...query, sections: ['tickets'] },
            this.actorFrom(req),
        );
        return report.ticketStats;
    }

    @Get('reports/agent-performance')
    @ApiOperation({ summary: 'Get agent performance report' })
    async getAgentPerformance(@Req() req: Request, @Query() query: ReportQueryDto): Promise<ManagerReport['agentPerformance']> {
        const report = await this.reportsService.generateReport(
            { ...query, sections: ['agents'] },
            this.actorFrom(req),
        );
        return report.agentPerformance;
    }

    @Get('reports/sla-metrics')
    @ApiOperation({ summary: 'Get SLA metrics report' })
    async getSlaMetrics(@Req() req: Request, @Query() query: ReportQueryDto): Promise<ManagerReport['slaMetrics']> {
        const report = await this.reportsService.generateReport(
            { ...query, sections: ['sla'] },
            this.actorFrom(req),
        );
        return report.slaMetrics;
    }

    @Get('reports/site-comparison')
    @ApiOperation({ summary: 'Get site comparison report' })
    async getSiteComparison(@Req() req: Request, @Query() query: ReportQueryDto): Promise<ManagerReport['siteComparison']> {
        const report = await this.reportsService.generateReport(
            { ...query, reportType: 'COMPARISON' as any, sections: ['tickets', 'sla'] },
            this.actorFrom(req),
        );
        return report.siteComparison;
    }

    private actorFrom(req: Request): SiteActor {
        return {
            role: ((req as any).user?.role) as UserRole,
            siteId: (req as any).user?.siteId ?? null,
        };
    }
}
