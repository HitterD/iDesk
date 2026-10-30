import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { IntegrationAppsService } from './integration-apps.service';
import { CreateIntegrationAppDto, UpdateIntegrationAppDto } from './dto/integration-app.dto';

/** Settings > Integrasi aplikasi: admins register office apps and decide what each may do. */
@ApiTags('Admin: connected apps')
@Controller('admin/integration-apps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AppsAdminController {
    constructor(private readonly apps: IntegrationAppsService) {}

    @Get()
    list() {
        return this.apps.list();
    }

    /** Returns the secret once; it is never shown again. */
    @Post()
    create(@Req() req: any, @Body() dto: CreateIntegrationAppDto) {
        return this.apps.create(dto, req.user.userId);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIntegrationAppDto) {
        return this.apps.update(id, dto);
    }

    @Post(':id/rotate-secret')
    @HttpCode(200)
    rotate(@Param('id', ParseUUIDPipe) id: string) {
        return this.apps.rotateSecret(id);
    }

    @Delete(':id')
    @HttpCode(204)
    async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        await this.apps.remove(id);
    }
}
