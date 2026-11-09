import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { SetReportOwnersDto } from '../dto/report-owner.dto';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiReportAccessService } from '../services/csi-report-access.service';

type CsiAdminRequest = { csiScope: ServiceScope };

/** Pengaturan → Penanggung jawab report: who reads each HC service report. */
@Controller('csi/admin/:scope/report-owners')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminReportOwnerController {
    constructor(private readonly access: CsiReportAccessService) { }

    @Get()
    list(@Req() req: CsiAdminRequest) {
        return this.access.listOwners(req.csiScope);
    }

    @Put(':serviceCode')
    set(@Req() req: CsiAdminRequest, @Param('serviceCode') serviceCode: string, @Body() dto: SetReportOwnersDto) {
        return this.access.setOwners(req.csiScope, serviceCode.toUpperCase(), dto.userIds);
    }
}
