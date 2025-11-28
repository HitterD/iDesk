import { Controller, Get, Patch, Body, Param, Post } from '@nestjs/common';
import { SlaConfigService } from './sla-config.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('SLA Config')
@Controller('sla-config')
export class SlaConfigController {
    constructor(private readonly slaConfigService: SlaConfigService) { }

    @Get()
    @ApiOperation({ summary: 'Get all SLA configurations' })
    findAll() {
        return this.slaConfigService.findAll();
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update SLA configuration' })
    update(@Param('id') id: string, @Body() body: { resolutionTimeMinutes: number }) {
        return this.slaConfigService.update(id, body.resolutionTimeMinutes);
    }

    @Post('reset')
    @ApiOperation({ summary: 'Reset SLA configuration to defaults' })
    reset() {
        return this.slaConfigService.resetDefaults();
    }
}
