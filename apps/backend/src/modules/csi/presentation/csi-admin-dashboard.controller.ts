import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiDashboardService } from '../services/csi-dashboard.service';

type CsiAdminRequest = { csiScope: ServiceScope };

@Controller('csi/admin/:scope/dashboard')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminDashboardController {
    constructor(private readonly dashboard: CsiDashboardService) { }

    @Get()
    get(@Req() req: CsiAdminRequest) {
        return this.dashboard.getDashboard(req.csiScope);
    }
}
