import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard } from '../guards/hardware-role.guard';
import { HardwareRoles } from '../guards/roles.decorator';
import { HardwareRole } from '../domain/enums/hardware-role.enum';
import { HardwareDashboardService } from '../services/hardware-dashboard.service';
import { DashboardAgingDto, DashboardRangeDto } from '../dto/dashboard-query.dto';

@Controller('hardware-requests/dashboard')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
@HardwareRoles(HardwareRole.ICT_STAFF)
export class HardwareDashboardController {
    constructor(private readonly svc: HardwareDashboardService) {}

    @Get('kpi')
    async kpi() {
        return { success: true, data: await this.svc.kpi() };
    }

    @Get('status-distribution')
    async statusDistribution() {
        return { success: true, data: await this.svc.statusDistribution() };
    }

    @Get('aging')
    async aging(@Query() q: DashboardAgingDto) {
        return { success: true, data: await this.svc.aging(q.thresholdDays) };
    }

    @Get('top-categories')
    async topCategories(@Query() q: DashboardRangeDto) {
        return { success: true, data: await this.svc.topCategories(q.range!) };
    }

    @Get('weekly-schedule')
    async weeklySchedule() {
        return { success: true, data: await this.svc.weeklySchedule() };
    }

    @Get('technician-workload')
    async technicianWorkload() {
        return { success: true, data: await this.svc.technicianWorkload() };
    }
}
