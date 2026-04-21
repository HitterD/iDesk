import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { HardwareRoleGuard, pickRole } from '../guards/hardware-role.guard';
import { HardwareActivityService } from '../services/hardware-activity.service';

@Controller('hardware-requests/:id/activity')
@UseGuards(JwtAuthGuard, HardwareRoleGuard)
export class HardwareActivityController {
    constructor(private readonly service: HardwareActivityService) {}

    @Get()
    async list(
        @Req() req: any,
        @Param('id', new ParseUUIDPipe()) requestId: string,
    ) {
        const role = pickRole(req.user);
        const data = await this.service.listForRequest({ id: req.user.userId, role }, requestId);
        return { success: true, data };
    }
}
