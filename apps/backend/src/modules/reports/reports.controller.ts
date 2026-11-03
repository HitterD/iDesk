import { BadRequestException, Body, Controller, Delete, Get, Param, Put, Query, Res, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../shared/core/decorators/page-access.decorator';
import { REPORT_TEAMS, ReportScope, resolveReportScope } from './utils/report-team-scope.util';
import { wibEndOfDate, wibStartOfDate } from '../../shared/core/utils/wib-date.util';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SIGNOFF_REPORT_TYPES, ReportSignoffService, SignoffReportType } from './services/report-signoff.service';
import { parseSignoffParam } from './generators/report-signoff';

/**
 * Every endpoint accepts `team` and `siteId`. They are resolved against the
 * caller: agents are pinned to their own team (and support agents to their
 * own site); ADMIN/MANAGER may pick any team and site.
 */
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess('reports')
export class ReportsController {
    constructor(
        private readonly reportsService: ReportsService,
        private readonly signoffService: ReportSignoffService,
    ) { }

    /** One-off layout from the preview dialog wins; otherwise the saved default for this site (or undefined = built-in). */
    private async signoffFor(type: SignoffReportType, scope: ReportScope, override?: string) {
        return parseSignoffParam(override, undefined) ?? this.signoffService.resolve(type, scope.siteId);
    }

    private signoffType(type: string): SignoffReportType {
        if (!(SIGNOFF_REPORT_TYPES as readonly string[]).includes(type)) throw new BadRequestException('Jenis laporan tidak dikenal');
        return type as SignoffReportType;
    }

    private scopeFor(req: any, team?: string, siteId?: string): ReportScope {
        return resolveReportScope(
            { role: req.user?.role, siteId: req.user?.siteId ?? null },
            team,
            siteId,
        );
    }

    private userIdOf(req: any): string | undefined {
        return req.user?.id || req.user?.userId;
    }

    // ==========================================
    // JSON Reports (Data)
    // ==========================================

    @Get('monthly')
    @ApiOperation({ summary: 'Get monthly ticket statistics' })
    @ApiQuery({ name: 'month', type: Number, example: 11 })
    @ApiQuery({ name: 'year', type: Number, example: 2024 })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    async getMonthlyStats(
        @Req() req: any,
        @Query('month') month: number,
        @Query('year') year: number,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
    ) {
        return this.reportsService.getMonthlyStats(Number(month), Number(year), this.scopeFor(req, team, siteId));
    }

    @Get('agent-performance')
    @ApiOperation({ summary: 'Get agent performance metrics for date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    async getAgentPerformance(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
    ) {
        return this.reportsService.getAgentPerformance(
            wibStartOfDate(startDate),
            wibEndOfDate(endDate),
            this.scopeFor(req, team, siteId),
        );
    }

    @Get('ticket-volume')
    @ApiOperation({ summary: 'Get ticket volume report for date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    async getTicketVolume(
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
    ) {
        return this.reportsService.getTicketVolume(
            wibStartOfDate(startDate),
            wibEndOfDate(endDate),
            this.scopeFor(req, team, siteId),
        );
    }

    // ==========================================
    // Excel Exports
    // ==========================================

    @Get('export/excel')
    @ApiOperation({ summary: 'Download monthly report as Excel' })
    @ApiQuery({ name: 'month', type: Number, example: 11 })
    @ApiQuery({ name: 'year', type: Number, example: 2024 })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    async exportExcel(
        @Res() res: Response,
        @Query('month') month: number,
        @Query('year') year: number,
        @Req() req: any,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
    ) {
        const scope = this.scopeFor(req, team, siteId);
        return this.reportsService.generateExcelReport(res, Number(month), Number(year), this.userIdOf(req), scope);
    }

    @Get('export/excel/custom')
    @ApiOperation({ summary: 'Download comprehensive Excel report for custom date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    async exportCustomExcel(
        @Res() res: Response,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: any,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
    ) {
        const scope = this.scopeFor(req, team, siteId);
        return this.reportsService.generateCustomRangeExcel(
            res,
            wibStartOfDate(startDate),
            wibEndOfDate(endDate),
            this.userIdOf(req),
            scope,
        );
    }

    // ==========================================
    // PDF Exports
    // ==========================================

    @Get('export/pdf/agent-performance')
    @ApiOperation({ summary: 'Download agent performance report as PDF' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    @ApiQuery({ name: 'signoff', type: String, required: false, description: 'One-off sign-off layout (JSON)' })
    async exportAgentPerformancePDF(
        @Res() res: Response,
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
        @Query('signoff') signoff?: string,
    ) {
        const scope = this.scopeFor(req, team, siteId);
        return this.reportsService.generateAgentPerformancePDF(
            res,
            wibStartOfDate(startDate),
            wibEndOfDate(endDate),
            this.userIdOf(req),
            scope,
            await this.signoffFor('agent-performance', scope, signoff),
        );
    }

    @Get('export/pdf/ticket-volume')
    @ApiOperation({ summary: 'Download ticket volume report as PDF' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    @ApiQuery({ name: 'signoff', type: String, required: false, description: 'One-off sign-off layout (JSON)' })
    async exportTicketVolumePDF(
        @Res() res: Response,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: any,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
        @Query('signoff') signoff?: string,
    ) {
        const scope = this.scopeFor(req, team, siteId);
        return this.reportsService.generateTicketVolumePDF(
            res,
            wibStartOfDate(startDate),
            wibEndOfDate(endDate),
            this.userIdOf(req),
            scope,
            await this.signoffFor('ticket-volume', scope, signoff),
        );
    }

    @Get('export/pdf/monthly')
    @ApiOperation({ summary: 'Download monthly summary as PDF' })
    @ApiQuery({ name: 'month', type: Number, example: 11 })
    @ApiQuery({ name: 'year', type: Number, example: 2024 })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    @ApiQuery({ name: 'team', enum: REPORT_TEAMS, required: false })
    @ApiQuery({ name: 'signoff', type: String, required: false, description: 'One-off sign-off layout (JSON)' })
    async exportMonthlySummaryPDF(
        @Res() res: Response,
        @Query('month') month: number,
        @Query('year') year: number,
        @Req() req: any,
        @Query('siteId') siteId?: string,
        @Query('team') team?: string,
        @Query('signoff') signoff?: string,
    ) {
        const scope = this.scopeFor(req, team, siteId);
        return this.reportsService.generateMonthlySummaryPDF(res, Number(month), Number(year), this.userIdOf(req), scope, await this.signoffFor('monthly', scope, signoff));
    }

    // ==========================================
    // Saved sign-off defaults (per report type and site)
    // ==========================================

    @Get('signoff/:type')
    @ApiOperation({ summary: 'Saved sign-off layout for a report type and site (null = built-in default)' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    async getSignoff(@Req() req: any, @Param('type') type: string, @Query('siteId') siteId?: string) {
        const scope = this.scopeFor(req, undefined, siteId);
        return { success: true, data: (await this.signoffService.resolve(this.signoffType(type), scope.siteId)) ?? null };
    }

    @Put('signoff/:type')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Save the default sign-off layout (ADMIN/MANAGER)' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    async saveSignoff(@Req() req: any, @Param('type') type: string, @Body() body: unknown, @Query('siteId') siteId?: string) {
        const scope = this.scopeFor(req, undefined, siteId);
        return { success: true, data: await this.signoffService.save(this.signoffType(type), scope.siteId, body, this.userIdOf(req)) };
    }

    @Delete('signoff/:type')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    @ApiOperation({ summary: 'Reset the sign-off layout to the built-in default (ADMIN/MANAGER)' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    async resetSignoff(@Req() req: any, @Param('type') type: string, @Query('siteId') siteId?: string) {
        const scope = this.scopeFor(req, undefined, siteId);
        await this.signoffService.reset(this.signoffType(type), scope.siteId);
        return { success: true };
    }
}
