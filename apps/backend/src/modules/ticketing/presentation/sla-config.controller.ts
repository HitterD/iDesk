import { Controller, Get, Patch, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
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
        return this.slaConfigService.findAll();
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update SLA configuration' })
    async update(
        @Param('id') id: string,
        @Body() body: { resolutionTimeMinutes?: number; responseTimeMinutes?: number },
    ) {
        return this.slaConfigService.update(id, body);
    }

    @Post()
    @ApiOperation({ summary: 'Create new SLA configuration' })
    async create(@Body() body: { priority: string; resolutionTimeMinutes: number; responseTimeMinutes?: number }) {
        return this.slaConfigService.create(body.priority, body.resolutionTimeMinutes, body.responseTimeMinutes);
    }

    @Post('reset')
    @ApiOperation({ summary: 'Reset SLA configurations to defaults' })
    async reset() {
        return this.slaConfigService.resetToDefaults();
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete SLA configuration' })
    async delete(@Param('id') id: string) {
        return this.slaConfigService.delete(id);
    }
}
