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
import { VpnStatusCreate, VpnArea } from './entities/vpn-access.entity';

@ApiTags('VPN Access')
@ApiBearerAuth()
@Controller('vpn-access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VpnAccessController {
    constructor(
        private readonly service: VpnAccessService,
        private readonly scheduler: VpnSchedulerService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all VPN access records' })
    @ApiQuery({ name: 'statusCreateVpn', enum: VpnStatusCreate, required: false })
    @ApiQuery({ name: 'area', enum: VpnArea, required: false })
    @ApiQuery({ name: 'search', required: false })
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
    async findAll(
        @Query('statusCreateVpn') statusCreateVpn?: VpnStatusCreate,
        @Query('area') area?: VpnArea,
        @Query('search') search?: string,
    ) {
        return this.service.findAll({ statusCreateVpn, area, search });
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get VPN access statistics' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
    async getStats() {
        return this.service.getStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get VPN access record by ID' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT)
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
        @Req() req: any,
    ) {
        return this.service.update(id, dto, req.user?.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete VPN access record' })
    @Roles(UserRole.ADMIN)
    async delete(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        await this.service.delete(id, req.user?.userId);
        return { success: true };
    }

    @Post('bulk-delete')
    @ApiOperation({ summary: 'Delete multiple VPN access records' })
    @Roles(UserRole.ADMIN)
    async bulkDelete(@Body('ids') ids: string[], @Req() req: any) {
        if (!ids || ids.length === 0) {
            return { success: false, message: 'No records to delete.' };
        }
        await this.service.deleteMany(ids, req.user?.userId);
        return { success: true, count: ids.length };
    }

    @Post('check-expirations')
    @ApiOperation({ summary: 'Manually trigger expiration check' })
    @Roles(UserRole.ADMIN)
    async triggerCheck() {
        await this.scheduler.triggerReminderCheck();
        return { success: true, message: 'Expiration check triggered' };
    }
}
