import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { CsiAdminGuard } from '../guards/csi-admin.guard';
import { CsiDashboardService } from '../services/csi-dashboard.service';

type CsiAdminRequest = { csiScope: ServiceScope; csiReadOnly?: boolean };

@Controller('csi/admin/:scope/dashboard')
@UseGuards(JwtAuthGuard, CsiAdminGuard)
export class CsiAdminDashboardController {
    constructor(private readonly dashboard: CsiDashboardService) { }

    @Get()
    async get(@Req() req: CsiAdminRequest) {
        const dashboard = await this.dashboard.getDashboard(req.csiScope);
        // Names of raters who have not answered stay with the admins.
        return req.csiReadOnly ? { ...dashboard, pending: [] } : dashboard;
    }
}
