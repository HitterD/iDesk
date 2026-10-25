import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { ResetResponseDto } from '../dto/report.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiExportService } from '../services/csi-export.service';
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
    ) { }

    @Get('report')
    report(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string) {
        return this.reports.getReport(req.csiScope, id);
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

    @Get('export')
    async export(@Req() req: CsiAdminRequest, @Param('id', CSI_ID_PIPE) id: string, @Res() res: Response) {
        const { filename, buffer } = await this.exporter.buildWorkbook(req.csiScope, id);
        res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
}
