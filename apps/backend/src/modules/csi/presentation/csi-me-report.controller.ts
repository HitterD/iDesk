import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { parseCsiScope } from '../csi.constants';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiReportAccessService } from '../services/csi-report-access.service';
import { CsiServiceReportService } from '../services/csi-service-report.service';

type CsiMeRequest = { user: { userId: string } };
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Service report for service report owners (any role) of a scope: `hc` (layanan) or `ict` (teams). The service checks
 * ownership on every call. `/csi/me/hc/...` is the path the HC page has always used.
 */
@Controller('csi/me/:scope')
@UseGuards(JwtAuthGuard)
export class CsiMeReportController {
    constructor(private readonly access: CsiReportAccessService, private readonly reports: CsiServiceReportService) { }

    @Get('report-access')
    reportAccess(@Req() req: CsiMeRequest, @Param('scope') scope: string) {
        return this.access.servicesFor(req.user.userId, parseCsiScope(scope));
    }

    @Get('periods')
    periods(@Req() req: CsiMeRequest, @Param('scope') scope: string) {
        return this.reports.listPeriods(req.user.userId, parseCsiScope(scope));
    }

    @Get('periods/:id/services/:serviceCode/report')
    report(@Req() req: CsiMeRequest, @Param('scope') scope: string, @Param('id', ID_PIPE) id: string, @Param('serviceCode') serviceCode: string) {
        return this.reports.get(req.user.userId, id, serviceCode, parseCsiScope(scope));
    }

    @Get('periods/:id/services/:serviceCode/export')
    async export(@Req() req: CsiMeRequest, @Param('scope') scope: string, @Param('id', ID_PIPE) id: string, @Param('serviceCode') serviceCode: string, @Res() res: Response) {
        const { filename, buffer } = await this.reports.exportWorkbook(req.user.userId, id, serviceCode, parseCsiScope(scope));
        res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
}
