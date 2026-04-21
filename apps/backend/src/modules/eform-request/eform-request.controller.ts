import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { EFormRequestService } from './eform-request.service';
import { CreateEFormRequestDto, ApproveManager1Dto } from './dto';

@ApiTags('E-Form Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('eform-request')
export class EFormRequestController {
  constructor(private readonly eformRequestService: EFormRequestService) {}

  @Post()
  @ApiOperation({ summary: 'Create new E-Form request and sign it' })
  async createRequest(@Request() req: any, @Body() dto: CreateEFormRequestDto) {
    return this.eformRequestService.createRequest(req.user.userId, req.user.fullName, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get all my requests' })
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
  @ApiOperation({ summary: 'Get details of a request' })
  async getDetails(@Param('id') id: string) {
    return this.eformRequestService.getDetails(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get PDF version of the form' })
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.eformRequestService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=EForm-VPN-${id}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Patch(':id/manager1-approve')
  @ApiOperation({ summary: 'Manager 1 approves and selects next approver' })
  async approveManager1(@Request() req: any, @Param('id') id: string, @Body() dto: ApproveManager1Dto) {
    return this.eformRequestService.approveManager1(id, req.user.userId, req.user.fullName, dto);
  }

  @Patch(':id/manager2-approve')
  @ApiOperation({ summary: 'Manager 2 (GM) approves' })
  async approveManager2(@Request() req: any, @Param('id') id: string, @Body() dto: { signatureData: string }) {
    return this.eformRequestService.approveManager2(id, req.user.userId, req.user.fullName, dto.signatureData);
  }

  @Patch(':id/ict-confirm')
  @ApiOperation({ summary: 'ICT Agent provision and confirm' })
  async confirmIct(@Request() req: any, @Param('id') id: string, @Body() dto: { username: string, password: string }) {
    return this.eformRequestService.confirmIct(id, req.user.userId, req.user.fullName, dto.username, dto.password);
  }

  @Get(':id/credentials')
  @ApiOperation({ summary: 'Requester securely views credentials' })
  async getCredentials(@Request() req: any, @Param('id') id: string) {
    return this.eformRequestService.getCredentials(id, req.user.userId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject request' })
  async rejectRequest(@Request() req: any, @Param('id') id: string, @Body() dto: { reason: string }) {
    return this.eformRequestService.rejectRequest(id, req.user.userId, dto.reason);
  }
}
