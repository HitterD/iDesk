import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { PageAccessGuard } from '../../../shared/core/guards/page-access.guard';
import { PageAccess } from '../../../shared/core/decorators/page-access.decorator';
import { RolesGuard } from '../../../shared/core/guards/roles.guard';
import { Roles } from '../../../shared/core/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

import { ScheduledReportsCrudService } from '../services/scheduled-reports-crud.service';
import { CreateScheduledReportConfigDto } from '../dto/create-scheduled-report-config.dto';
import { UpdateScheduledReportConfigDto } from '../dto/update-scheduled-report-config.dto';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';

/**
 * Scheduled Reports Controller
 *
 * All routes require page access 'reports'.
 * Management (create/update/delete/toggle/trigger) is intended for ADMIN and MANAGER.
 * Listing and viewing may be visible to anyone who has the 'reports' page access.
 */
@ApiTags('Scheduled Reports')
@ApiBearerAuth()
@Controller('reports/scheduled')
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess('reports')
export class ScheduledReportsController {
  constructor(private readonly crud: ScheduledReportsCrudService) {}

  @Get()
  @ApiOperation({ summary: 'List scheduled report configs (site-scoped)' })
  @ApiQuery({ name: 'siteId', required: false, description: 'Optional site filter (cross-site roles only)' })
  async list(@Req() req: any, @Query('siteId') siteId?: string) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const data = await this.crud.list(actor, siteId);
    return { success: true, data };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new scheduled report config' })
  async create(@Req() req: any, @Body() dto: CreateScheduledReportConfigDto) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const createdById = req.user?.id || req.user?.userId;
    const data = await this.crud.create(actor, dto, createdById);
    return { success: true, data };
  }

  /**
   * MUST stay declared before @Get(':id') — otherwise 'recipients' is matched
   * as the :id param and rejected by ParseUUIDPipe.
   */
  @Get('recipients')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List eligible recipients (active agents) for a site' })
  @ApiQuery({ name: 'siteId', required: false, description: 'Required for cross-site roles; ignored for site-locked actors' })
  async listRecipients(@Req() req: any, @Query('siteId') siteId?: string) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const data = await this.crud.listRecipientCandidates(actor, siteId);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scheduled report config by ID' })
  @ApiParam({ name: 'id', type: String })
  async findOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const data = await this.crud.findOne(actor, id);
    return { success: true, data };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a scheduled report config' })
  @ApiParam({ name: 'id', type: String })
  async update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateScheduledReportConfigDto,
  ) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const data = await this.crud.update(actor, id, dto);
    return { success: true, data };
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Enable or disable a scheduled report config' })
  @ApiParam({ name: 'id', type: String })
  async toggle(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { isActive: boolean },
  ) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const data = await this.crud.toggle(actor, id, body.isActive);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Soft-delete a scheduled report config' })
  @ApiParam({ name: 'id', type: String })
  async remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const result = await this.crud.remove(actor, id);
    return result;
  }

  @Post(':id/trigger')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger a scheduled report now (ADMIN + MANAGER only)' })
  @ApiParam({ name: 'id', type: String })
  async trigger(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const result = await this.crud.triggerNow(actor, id);
    return result;
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get execution history for a scheduled report config' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  async listExecutions(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
  ) {
    const actor: SiteActor = {
      role: req.user.role,
      siteId: req.user.siteId ?? null,
    };
    const lim = limit ? parseInt(limit, 10) : 50;
    const data = await this.crud.listExecutions(actor, id, lim);
    return { success: true, data };
  }
}
