import { Controller, Get, Query, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('monthly')
    @ApiOperation({ summary: 'Get monthly ticket statistics' })
    async getMonthlyStats(
        @Query('month') month: number,
        @Query('year') year: number,
    ) {
        return this.reportsService.getMonthlyStats(Number(month), Number(year));
    }

    @Get('export/excel')
    @ApiOperation({ summary: 'Download monthly report as Excel' })
    async exportExcel(
        @Res() res: Response,
        @Query('month') month: number,
        @Query('year') year: number,
    ) {
        return this.reportsService.generateExcelReport(res, Number(month), Number(year));
    }
}
