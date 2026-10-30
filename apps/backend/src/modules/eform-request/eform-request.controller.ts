import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor } from '../../shared/core/utils/site-scope.util';
import { EFormRequestService } from './eform-request.service';
import { SynologyNasBrowseService } from './synology-nas-browse.service';
import { CreateEFormRequestDto, ApproveManagerDto, SubmitCredentialDto, FulfillRequestDto, BrowseNasFolderDto, SearchNasFolderDto, SyncNasCacheDto } from './dto';

@ApiTags('E-Form Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('eform-request')
export class EFormRequestController {
  constructor(
    private readonly eformRequestService: EFormRequestService,
    private readonly nasBrowseService: SynologyNasBrowseService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new E-Form request' })
  async createRequest(@Request() req: any, @Body() dto: CreateEFormRequestDto) {
    return this.eformRequestService.createRequest(req.user.userId, req.user.fullName || req.user.username || 'Unknown', dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my requests' })
  async getMyRequests(@Request() req: any) {
    return this.eformRequestService.getMyRequests(req.user.userId);
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Get pending requests for manager' })
  async getPendingApprovals(@Request() req: any) {
    return this.eformRequestService.getPendingApprovals(req.user.userId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all requests (Admin/Manager/Agent only)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT_ADMIN)
  async findAll(@Request() req: any) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.findAll(actor);
  }

  @Get('terms')
  @ApiOperation({ summary: 'Get VPN Terms & Conditions' })
  async getTerms() {
    return { terms: await this.eformRequestService.getVpnTerms() };
  }

  @Patch('terms')
  @ApiOperation({ summary: 'Update VPN Terms & Conditions (Admin only)' })
  @Roles(UserRole.ADMIN)
  async updateTerms(@Request() req: any, @Body() dto: { terms: string }) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.setVpnTerms(dto.terms, req.user.userId, actor);
  }

  @Get('nas/servers')
  @ApiOperation({ summary: 'Get available Synology NAS servers for E-Form' })
  async getNasServers() {
    return this.nasBrowseService.getNasServers();
  }

  @Get('nas/status')
  @ApiOperation({ summary: 'Get cache and sync status for Synology NAS servers' })
  async getNasCacheStatus() {
    return this.nasBrowseService.getCacheStatus();
  }

  @Post('nas/sync')
  @ApiOperation({ summary: 'Trigger background folder cache sync for a Synology NAS server' })
  async syncNasCache(@Body() dto: SyncNasCacheDto) {
    return this.nasBrowseService.syncServerCache(dto.serverId, dto.force);
  }

  @Post('nas/browse')
  @ApiOperation({ summary: 'Browse folders on a Synology NAS server via FileStation' })
  async browseNasFolders(@Body() dto: BrowseNasFolderDto) {
    return this.nasBrowseService.browseNasFolders(dto);
  }

  @Post('nas/search')
  @ApiOperation({ summary: 'Global recursive search for folders on a Synology NAS server' })
  async searchNasFolders(@Body() dto: SearchNasFolderDto) {
    return this.nasBrowseService.searchNasFolders(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request details' })
  async getDetails(@Param('id') id: string, @Request() req: any) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.getDetails(actor, id, req.user.userId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download PDF' })
  async getPdf(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    const buffer = await this.eformRequestService.generatePdf(actor, id, req.user.userId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=EForm-VPN-${id}.pdf`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Patch(':id/manager-approve')
  @ApiOperation({ summary: 'Manager approves or rejects request' })
  async approveByManager(@Request() req: any, @Param('id') id: string, @Body() dto: ApproveManagerDto) {
    return this.eformRequestService.approveByManager(id, req.user.userId, req.user.fullName || req.user.username || 'Unknown', dto);
  }

  @Post(':id/credentials')
  @ApiOperation({ summary: 'ICT submits credentials (ADMIN/AGENT_ADMIN only)' })
  async submitCredentials(@Request() req: any, @Param('id') id: string, @Body() dto: SubmitCredentialDto) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.submitCredentials(actor, id, req.user.userId, req.user.role, dto);
  }

  @Get(':id/credentials')
  @ApiOperation({ summary: 'View credentials (ICT or requester)' })
  async getCredentials(@Request() req: any, @Param('id') id: string) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.getCredentials(actor, id, req.user.userId, req.user.role);
  }

  @Post(':id/fulfill')
  @ApiOperation({ summary: 'ICT marks access granted without issuing credentials' })
  async fulfillRequest(@Request() req: any, @Param('id') id: string, @Body() dto: FulfillRequestDto) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.fulfillRequest(actor, id, req.user.userId, req.user.role, dto);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject request (assigned approver or ICT)' })
  async rejectRequest(@Request() req: any, @Param('id') id: string, @Body() dto: { reason: string }) {
    const actor: SiteActor = { role: req.user.role, siteId: req.user.siteId ?? null };
    return this.eformRequestService.rejectRequest(actor, id, req.user.userId, req.user.role, dto.reason);
  }
}
