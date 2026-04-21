import { Controller, Get, Patch, Body, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SlaConfigService } from './sla-config.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('SLA Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sla-config')
export class SlaConfigController {
    constructor(private readonly slaConfigService: SlaConfigService) { }

    @Get()
    @ApiOperation({ summary: 'Get all SLA configurations' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    findAll() {
        return this.slaConfigService.findAll();
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update SLA configuration' })
    @Roles(UserRole.ADMIN)
    update(@Param('id') id: string, @Body() body: { resolutionTimeMinutes: number }, @Req() req: any) {
        return this.slaConfigService.update(id, body.resolutionTimeMinutes, req.user?.id || req.user?.userId);
    }

    @Post('reset')
    @ApiOperation({ summary: 'Reset SLA configuration to defaults' })
    @Roles(UserRole.ADMIN)
    reset(@Req() req: any) {
        return this.slaConfigService.resetDefaults(req.user?.id || req.user?.userId);
    }
}
