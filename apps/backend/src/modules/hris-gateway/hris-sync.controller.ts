import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { HrisSyncService } from './hris-sync.service';

@ApiTags('HRIS Sync')
@ApiBearerAuth()
@Controller('hris-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HrisSyncController {
    constructor(private readonly hrisSyncService: HrisSyncService) {}

    @Post('run')
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Sync semua karyawan HRIS ke iDesk (admin only)' })
    run() {
        return this.hrisSyncService.syncAll();
    }
}
