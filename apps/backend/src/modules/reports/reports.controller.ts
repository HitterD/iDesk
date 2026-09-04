import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { PageAccessGuard } from '../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../shared/core/decorators/page-access.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    // ==========================================
    // JSON Reports (Data)
    // ==========================================

    @Get('monthly')
    @ApiOperation({ summary: 'Get monthly ticket statistics' })
    @ApiQuery({ name: 'month', type: Number, example: 11 })
    @ApiQuery({ name: 'year', type: Number, example: 2024 })
    async getMonthlyStats(
        @Query('month') month: number,
        @Query('year') year: number,
        @Query('siteId') siteId?: string,
    ) {
        return this.reportsService.getMonthlyStats(Number(month), Number(year), siteId);
    }

    @Get('agent-performance')
    @ApiOperation({ summary: 'Get agent performance metrics for date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async getAgentPerformance(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('siteId') siteId?: string,
        @Query('agentCategory') agentCategory?: 'REGULAR' | 'ORACLE' | 'ALL',
    ) {
        return this.reportsService.getAgentPerformance(
            new Date(startDate),
            new Date(endDate),
            siteId,
            agentCategory,
        );
    }

    @Get('ticket-volume')
    @ApiOperation({ summary: 'Get ticket volume report for date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    @ApiQuery({ name: 'siteId', type: String, required: false })
    async getTicketVolume(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('siteId') siteId?: string,
    ) {
        return this.reportsService.getTicketVolume(
            new Date(startDate),
            new Date(endDate),
            siteId,
        );
    }

    // ==========================================
    // Excel Exports
    // ==========================================

    @Get('export/excel')
    @ApiOperation({ summary: 'Download monthly report as Excel' })
    @ApiQuery({ name: 'month', type: Number, example: 11 })
    @ApiQuery({ name: 'year', type: Number, example: 2024 })
    async exportExcel(
        @Res() res: Response,
        @Query('month') month: number,
        @Query('year') year: number,
        @Req() req: any,
    ) {
        return this.reportsService.generateExcelReport(res, Number(month), Number(year), req.user?.id || req.user?.userId);
    }

    @Get('export/excel/custom')
    @ApiOperation({ summary: 'Download comprehensive Excel report for custom date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async exportCustomExcel(
        @Res() res: Response,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: any,
    ) {
        return this.reportsService.generateCustomRangeExcel(
            res,
            new Date(startDate),
            new Date(endDate),
            req.user?.id || req.user?.userId,
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
    @ApiQuery({ name: 'agentCategory', enum: ['REGULAR', 'ORACLE', 'DEV', 'ALL'], required: false })
    async exportAgentPerformancePDF(
        @Res() res: Response,
        @Req() req: any,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('siteId') siteId?: string,
        @Query('agentCategory') agentCategory?: 'REGULAR' | 'ORACLE' | 'DEV' | 'ALL',
    ) {
        return this.reportsService.generateAgentPerformancePDF(
            res,
            new Date(startDate),
            new Date(endDate),
            req.user?.id || req.user?.userId,
            siteId,
            agentCategory,
        );
    }

    @Get('export/pdf/ticket-volume')
    @ApiOperation({ summary: 'Download ticket volume report as PDF' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async exportTicketVolumePDF(
        @Res() res: Response,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Req() req: any,
    ) {
        return this.reportsService.generateTicketVolumePDF(
            res,
            new Date(startDate),
            new Date(endDate),
            req.user?.id || req.user?.userId,
        );
    }

    @Get('export/pdf/monthly')
    @ApiOperation({ summary: 'Download monthly summary as PDF' })
    @ApiQuery({ name: 'month', type: Number, example: 11 })
    @ApiQuery({ name: 'year', type: Number, example: 2024 })
    async exportMonthlySummaryPDF(
        @Res() res: Response,
        @Query('month') month: number,
        @Query('year') year: number,
        @Req() req: any,
    ) {
        return this.reportsService.generateMonthlySummaryPDF(res, Number(month), Number(year), req.user?.id || req.user?.userId);
    }
}
