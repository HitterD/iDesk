import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiReportAccessService } from '../services/csi-report-access.service';
import { CsiServiceReportService } from '../services/csi-service-report.service';

type CsiMeRequest = { user: { userId: string } };
const ID_PIPE = new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('ID harus berupa UUID') });
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** HC service report for service report owners (any role); the service checks ownership on every call. */
@Controller('csi/me/hc')
@UseGuards(JwtAuthGuard)
export class CsiMeReportController {
    constructor(private readonly access: CsiReportAccessService, private readonly reports: CsiServiceReportService) { }

    @Get('report-access')
    reportAccess(@Req() req: CsiMeRequest) {
        return this.access.servicesFor(req.user.userId, ServiceScope.HC);
    }

    @Get('periods')
    periods(@Req() req: CsiMeRequest) {
        return this.reports.listPeriods(req.user.userId);
    }

    @Get('periods/:id/services/:serviceCode/report')
    report(@Req() req: CsiMeRequest, @Param('id', ID_PIPE) id: string, @Param('serviceCode') serviceCode: string) {
        return this.reports.get(req.user.userId, id, serviceCode);
    }

    @Get('periods/:id/services/:serviceCode/export')
    async export(@Req() req: CsiMeRequest, @Param('id', ID_PIPE) id: string, @Param('serviceCode') serviceCode: string, @Res() res: Response) {
        const { filename, buffer } = await this.reports.exportWorkbook(req.user.userId, id, serviceCode);
        res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    }
}
