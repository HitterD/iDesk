import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    ParseUUIDPipe,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CreateSiteDto, UpdateSiteDto } from './dto';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Sites')
@ApiBearerAuth()
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SitesController {
    constructor(private readonly sitesService: SitesService) { }

    @Get()
    @ApiOperation({ summary: 'Get all sites' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    findAll() {
        return this.sitesService.findAll();
    }

    @Get('active')
    @ApiOperation({ summary: 'Get all active sites' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT, UserRole.USER)
    findActive() {
        return this.sitesService.findActive();
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get site statistics' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    getSiteStats() {
        return this.sitesService.getSiteStats();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get site by ID' })
    @Roles(UserRole.ADMIN, UserRole.MANAGER)
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.sitesService.findOne(id);
    }

    @Get('code/:code')
    @ApiOperation({ summary: 'Get site by code' })
    findByCode(@Param('code') code: string) {
        return this.sitesService.findByCode(code);
    }

    @Post()
    @ApiOperation({ summary: 'Create a new site' })
    @Roles(UserRole.ADMIN)
    create(@Body() createSiteDto: CreateSiteDto, @Req() req: any) {
        return this.sitesService.create(createSiteDto, req.user?.id || req.user?.userId);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a site' })
    @Roles(UserRole.ADMIN)
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateSiteDto: UpdateSiteDto,
        @Req() req: any,
    ) {
        return this.sitesService.update(id, updateSiteDto, req.user?.id || req.user?.userId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a site' })
    @Roles(UserRole.ADMIN)
    remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.sitesService.remove(id, req.user?.id || req.user?.userId);
    }
}
