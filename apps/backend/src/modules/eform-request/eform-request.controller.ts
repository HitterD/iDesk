import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { EFormRequestService } from './eform-request.service';
import { CreateEFormRequestDto, ApproveManagerDto, SubmitCredentialDto } from './dto';

@ApiTags('E-Form Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('eform-request')
export class EFormRequestController {
  constructor(private readonly eformRequestService: EFormRequestService) {}

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
  @ApiOperation({ summary: 'Get requests pending my approval' })
  async getPendingApprovals(@Request() req: any) {
    return this.eformRequestService.getPendingApprovals(req.user.userId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all requests (Admin/Agent only)' })
  async findAll() {
    return this.eformRequestService.findAll();
  }

  @Get('terms')
  @ApiOperation({ summary: 'Get VPN Terms & Conditions' })
  async getTerms() {
    return { terms: await this.eformRequestService.getVpnTerms() };
  }

  @Patch('terms')
  @ApiOperation({ summary: 'Update VPN Terms & Conditions (Admin only)' })
  async updateTerms(@Request() req: any, @Body() dto: { terms: string }) {
    return this.eformRequestService.setVpnTerms(dto.terms, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get request details' })
  async getDetails(@Param('id') id: string) {
    return this.eformRequestService.getDetails(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download PDF' })
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.eformRequestService.generatePdf(id);
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
    return this.eformRequestService.submitCredentials(id, req.user.userId, dto);
  }

  @Get(':id/credentials')
  @ApiOperation({ summary: 'View credentials (ICT or requester)' })
  async getCredentials(@Request() req: any, @Param('id') id: string) {
    return this.eformRequestService.getCredentials(id, req.user.userId, req.user.role);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject request' })
  async rejectRequest(@Request() req: any, @Param('id') id: string, @Body() dto: { reason: string }) {
    return this.eformRequestService.rejectRequest(id, req.user.userId, dto.reason);
  }
}
