import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { SlaConfigService } from '../sla-config.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('SLA Config')
@Controller('sla-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SlaConfigController {
    constructor(private readonly slaConfigService: SlaConfigService) { }

    @Get()
    @ApiOperation({ summary: 'Get all SLA configurations' })
    async findAll() {
        console.log('SlaConfigController.findAll called');
        return this.slaConfigService.findAll();
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update SLA configuration' })
    async update(
        @Param('id') id: string,
        @Body('resolutionTimeMinutes') resolutionTimeMinutes: number,
    ) {
        return this.slaConfigService.update(id, resolutionTimeMinutes);
    }
}
