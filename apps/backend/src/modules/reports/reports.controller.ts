import { Controller, Get, Query, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('reports')
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
    ) {
        return this.reportsService.getMonthlyStats(Number(month), Number(year));
    }

    @Get('agent-performance')
    @ApiOperation({ summary: 'Get agent performance metrics for date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async getAgentPerformance(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.getAgentPerformance(
            new Date(startDate),
            new Date(endDate),
        );
    }

    @Get('ticket-volume')
    @ApiOperation({ summary: 'Get ticket volume report for date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async getTicketVolume(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.getTicketVolume(
            new Date(startDate),
            new Date(endDate),
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
    ) {
        return this.reportsService.generateExcelReport(res, Number(month), Number(year));
    }

    @Get('export/excel/custom')
    @ApiOperation({ summary: 'Download comprehensive Excel report for custom date range' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async exportCustomExcel(
        @Res() res: Response,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.generateCustomRangeExcel(
            res,
            new Date(startDate),
            new Date(endDate),
        );
    }

    // ==========================================
    // PDF Exports
    // ==========================================

    @Get('export/pdf/agent-performance')
    @ApiOperation({ summary: 'Download agent performance report as PDF' })
    @ApiQuery({ name: 'startDate', type: String, example: '2024-01-01' })
    @ApiQuery({ name: 'endDate', type: String, example: '2024-01-31' })
    async exportAgentPerformancePDF(
        @Res() res: Response,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.reportsService.generateAgentPerformancePDF(
            res,
            new Date(startDate),
            new Date(endDate),
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
    ) {
        return this.reportsService.generateTicketVolumePDF(
            res,
            new Date(startDate),
            new Date(endDate),
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
    ) {
        return this.reportsService.generateMonthlySummaryPDF(res, Number(month), Number(year));
    }
}
