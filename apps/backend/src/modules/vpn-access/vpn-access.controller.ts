import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { VpnAccessService } from './vpn-access.service';
import { VpnSchedulerService } from './vpn-scheduler.service';
import { CreateVpnAccessDto, UpdateVpnAccessDto } from './dto';
import { VpnStatus, VpnType } from './entities/vpn-access.entity';

@ApiTags('VPN Access')
@ApiBearerAuth()
@Controller('vpn-access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VpnAccessController {
    constructor(
        private readonly service: VpnAccessService,
        private readonly scheduler: VpnSchedulerService,
    ) { }

    // === CRUD ===

    @Get()
    @ApiOperation({ summary: 'Get all VPN access records' })
    @ApiQuery({ name: 'status', enum: VpnStatus, required: false })
    @ApiQuery({ name: 'vpnType', enum: VpnType, required: false })
    @ApiQuery({ name: 'site', required: false })
    @ApiQuery({ name: 'search', required: false })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async findAll(
        @Query('status') status?: VpnStatus,
        @Query('vpnType') vpnType?: VpnType,
        @Query('site') site?: string,
        @Query('search') search?: string,
    ) {
        return this.service.findAll({ status, vpnType, site, search });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get VPN access statistics' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async getStats() {
        return this.service.getStats();
    }

    @Get('expiring')
    @ApiOperation({ summary: 'Get VPNs expiring within specified days' })
    @ApiQuery({ name: 'days', required: false })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async findExpiring(@Query('days') days?: number) {
        return this.service.findExpiring(days || 30);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get VPN access record by ID' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findById(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create new VPN access record' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async create(@Body() dto: CreateVpnAccessDto, @Req() req: any) {
        return this.service.create(dto, req.user?.userId);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update VPN access record' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateVpnAccessDto,
    ) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete VPN access record' })
    @Roles(UserRole.ADMIN)
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        await this.service.delete(id);
        return { success: true };
    }

    // === ACTIONS ===

    @Post(':id/acknowledge')
    @ApiOperation({ summary: 'Acknowledge VPN expiry alert' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async acknowledge(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.service.acknowledge(id, req.user?.userId);
    }

    @Post(':id/revoke')
    @ApiOperation({ summary: 'Revoke VPN access' })
    @Roles(UserRole.ADMIN)
    async revoke(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.service.setStatus(id, VpnStatus.REVOKED, req.user?.userId);
    }

    @Post(':id/renew')
    @ApiOperation({ summary: 'Renew VPN access (reset to active)' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    async renew(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: { validUntil: Date },
    ) {
        return this.service.update(id, {
            validUntil: new Date(dto.validUntil),
            status: VpnStatus.ACTIVE,
        });
    }

    // === SCHEDULER ===

    @Post('check-expirations')
    @ApiOperation({ summary: 'Manually trigger expiration check' })
    @Roles(UserRole.ADMIN)
    async triggerCheck() {
        await this.scheduler.triggerReminderCheck();
        return { success: true, message: 'Expiration check triggered' };
    }
}
