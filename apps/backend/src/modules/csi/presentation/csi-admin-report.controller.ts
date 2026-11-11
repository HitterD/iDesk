import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { ReportExportQueryDto, ReportQueryDto, ResetResponseDto, SendRemindersDto } from '../dto/report.dto';
import { ReportSignoffService } from '../../reports/services/report-signoff.service';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { csiSignoffType, CsiExportService } from '../services/csi-export.service';
import { CsiReminderService } from '../services/csi-reminder.service';
import { CsiReportService } from '../services/csi-report.service';

type CsiAdminRequest = Request & { csiScope: ServiceScope; user: { userId: string } };
const CSI_ID_PIPE = new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID harus berupa UUID'),
});
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('csi/admin/:scope/periods/:id')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminReportController {
    constructor(
        private readonly reports: CsiReportService,
        private readonly exporter: CsiExportService,
        private readonly reminders: CsiReminderService,
    ) { }

    @Get('report')
    report(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Query() query: ReportQueryDto) {
        return this.reports.getReport(req.csiScope, id, query.siteId);
    }

    /** HC per-PIC recap (layanan / bagian / PIC and respondent groups, per location and ALL SJA). */
    @Get('hc-recap')
    hcRecap(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.reports.getHcRecap(req.csiScope, id);
    }

    @Get('rater-matrix')
    raterMatrix(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Query() query: ReportQueryDto) {
        return this.reports.getRaterMatrix(req.csiScope, id, query.siteId);
    }

    @Post('reminders')
    @HttpCode(HttpStatus.OK)
    sendReminders(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Body() dto: SendRemindersDto) {
        return this.reminders.send(req.csiScope, id, dto.userIds);
    }

    @Get('respondents')
    respondents(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.reports.getRespondents(req.csiScope, id);
    }

    @Get('responses/:responseId')
    responseDetail(
        @Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Param('responseId', CSI_ID_PIPE) responseId: string,
    ) {
        return this.reports.getResponseDetail(req.csiScope, id, responseId);
    }

    @Delete('responses/:responseId')
    resetResponse(
        @Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string,
        @Param('responseId', CSI_ID_PIPE) responseId: string, @Body() dto: ResetResponseDto,
    ) {
        return this.reports.resetResponse(req.csiScope, id, responseId, dto.reason, { id: req.user.userId }, req);
    }

    @Get('report.pdf')
    async reportPdf(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Query() query: ReportExportQueryDto, @Res() res: Response) {
        const { filename, buffer } = await this.exporter.buildPdf(req.csiScope, id, query);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }

    @Get('export')
    async export(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Query() query: ReportExportQueryDto, @Res() res: Response) {
        const { filename, buffer } = await this.exporter.buildWorkbook(req.csiScope, id, new Date(), { notes: query.notes });
        res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }

    /** Raw data (names the raters): separate file and endpoint, same admin guard as the report export. */
    @Get('export-raw')
    async exportRaw(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Res() res: Response) {
        const { filename, buffer } = await this.exporter.buildRawWorkbook(req.csiScope, id, new Date());
        res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
}

/** Sign-off of the CSI report PDF, one saved layout per CSI scope (none saved = the memo signers). */
@Controller('csi/admin/:scope/report-signoff')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminReportSignoffController {
    constructor(private readonly exporter: CsiExportService, private readonly signoffs: ReportSignoffService) { }

    @Get()
    async get(@Req() req: CsiAdminRequest) {
        return { layout: await this.exporter.signoffFor(req.csiScope) };
    }

    @Put()
    async save(@Req() req: CsiAdminRequest, @Body() body: unknown) {
        return { layout: await this.signoffs.save(csiSignoffType(req.csiScope), null, body, req.user.userId) };
    }

    @Delete()
    async reset(@Req() req: CsiAdminRequest) {
        await this.signoffs.reset(csiSignoffType(req.csiScope));
        return { layout: await this.exporter.signoffFor(req.csiScope) };
    }
}
