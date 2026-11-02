import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers, Request, UnauthorizedException } from '@nestjs/common';
import { SjaDataStoreService } from '../datastore/sja-datastore.service';

@Controller('v1')
export class SjaApiController {
  constructor(private readonly dataStore: SjaDataStoreService) {}

  // 1. Apps Endpoint
  @Get('apps')
  getApps() {
    return this.dataStore.getApps();
  }

  @Post('apps')
  createApp(@Body() body: any) {
    return this.dataStore.createApp(body);
  }

  @Put('apps/:id')
  updateApp(@Param('id') id: string, @Body() body: any) {
    return this.dataStore.updateApp(id, body);
  }

  @Delete('apps/:id')
  deleteApp(@Param('id') id: string) {
    return { success: this.dataStore.deleteApp(id) };
  }

  @Post('apps/:id/rotate-secret')
  rotateAppSecret(@Param('id') id: string) {
    return this.dataStore.rotateAppSecret(id);
  }

  // 2. Templates Endpoint
  @Get('templates')
  getTemplates(@Query('appCode') appCode?: string) {
    return this.dataStore.getTemplates(appCode);
  }

  @Post('templates')
  createTemplate(@Body() body: any) {
    return this.dataStore.createTemplate(body);
  }

  @Put('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() body: any) {
    return this.dataStore.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return { success: this.dataStore.deleteTemplate(id) };
  }

  // 3. Devices Endpoint (Sanitized Public List & Admin Management)
  @Get('devices')
  getDevices(@Query('siteCode') siteCode?: string) {
    // Return sanitized public representation (No deviceTokenHash leakage)
    return this.dataStore.getPublicDevices(siteCode);
  }

  @Delete('devices/:id')
  revokeDevice(@Param('id') id: string) {
    return { success: this.dataStore.revokeDevice(id) };
  }

  // 3b. Remote Desktop Overlay Configuration & Session Management
  @Get('remote/overlay-config')
  getRemoteOverlayConfig() {
    return this.dataStore.getOverlayConfig();
  }

  @Put('remote/overlay-config')
  updateRemoteOverlayConfig(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    // Fail-closed: hanya perangkat ADMIN / AGENT* yang boleh mengubah konten overlay.
    const device = this.authenticateDevice(authorization);
    if (!this.isRemoteOperatorRole(device.employeeRole)) {
      throw new UnauthorizedException('Hanya ADMIN atau AGENT yang boleh mengubah konfigurasi overlay remote');
    }
    return this.dataStore.updateOverlayConfig(body);
  }

  private isRemoteOperatorRole(role: unknown): boolean {
    if (typeof role !== 'string' || !role.trim()) return false;
    const normalized = role.trim().toUpperCase();
    return normalized === 'ADMIN' || normalized.startsWith('AGENT');
  }

  @Post('remote/session/request')
  requestRemoteSession(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      targetDeviceId: string;
      agentName?: string;
      agentIp?: string;
    },
  ) {
    const agent = this.authenticateDevice(authorization);
    if (agent.id === body.targetDeviceId) {
      throw new UnauthorizedException('Perangkat tidak dapat me-remote dirinya sendiri');
    }
    return this.dataStore.createRemoteSession({
      targetDeviceId: body.targetDeviceId,
      agentDeviceId: agent.id,
      agentName: body.agentName || agent.employeeName || 'Santos ICT Support',
      agentIp: body.agentIp || agent.ipAddress || '10.10.x.x',
    });
  }

  @Get('remote/session/:sessionId')
  getRemoteSession(
    @Headers('authorization') authorization: string | undefined,
    @Param('sessionId') sessionId: string,
  ) {
    const device = this.authenticateDevice(authorization);
    const session = this.dataStore.getRemoteSessionForDevice(sessionId, device.id);
    if (!session) return { error: 'Session tidak ditemukan atau akses ditolak' };
    return session;
  }

  private authenticateDevice(authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Device token diperlukan');
    const device = this.dataStore.findDeviceByToken(token);
    if (!device) throw new UnauthorizedException('Device token tidak valid');
    return device;
  }

  @Post('remote/session/:sessionId/end')
  endRemoteSession(@Param('sessionId') sessionId: string, @Body() body: { reason?: string }) {
    return { success: this.dataStore.endRemoteSession(sessionId, body.reason) };
  }

  // 4. Device Activation Pairing
  @Post('devices/activation/request')
  requestActivation(@Body() body: { deviceName: string; windowsUsername: string }) {
    return this.dataStore.createActivationSession(body);
  }

  @Post('devices/activation/approve')
  approveActivation(@Body() body: { code: string; employeeId: string; name: string; role?: string }) {
    return this.dataStore.approveActivation(body.code, {
      employeeId: body.employeeId,
      name: body.name,
      role: body.role,
    });
  }

  @Get('devices/activation/poll')
  pollActivation(@Query('sessionId') sessionId: string) {
    return this.dataStore.pollActivation(sessionId);
  }

  // 4b. Direct Enterprise Desktop Login (iDesk Single Truth Credential)
  @Post('devices/auth/login')
  async loginDevice(
    @Request() req: any,
    @Body() body: { nik: string; password: string; deviceName?: string; windowsUsername?: string }
  ) {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    let clientIp = '';
    if (typeof forwardedFor === 'string') {
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (req.socket?.remoteAddress) {
      clientIp = req.socket.remoteAddress;
    }
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }
    return this.dataStore.loginWithIdeskCredentials({ ...body, clientIp });
  }

  // 4c. Keycloak OAuth 2.0 / OpenID Connect Token Exchange for Devices
  @Post('devices/auth/keycloak-token')
  async exchangeKeycloakToken(
    @Request() req: any,
    @Body() body: { idToken?: string; accessToken: string; deviceName?: string; windowsUsername?: string }
  ) {
    const forwardedFor = req.headers?.['x-forwarded-for'];
    let clientIp = '';
    if (typeof forwardedFor === 'string') {
      clientIp = forwardedFor.split(',')[0].trim();
    } else if (req.socket?.remoteAddress) {
      clientIp = req.socket.remoteAddress;
    }
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }
    return this.dataStore.exchangeKeycloakToken({ ...body, clientIp });
  }

  // 5. Delivery Logs Endpoint
  @Get('logs')
  getLogs() {
    return this.dataStore.getLogs();
  }

  // 6. Health Summary Endpoint
  @Get('health')
  getHealth() {
    return this.dataStore.getHealthSummary();
  }

  // 6b. Acknowledge Notification Read Receipt (Compatible with legacy /api/Notification/IsRead)
  @Post('notifications/is-read')
  markNotificationRead(@Body() body: { id?: string; jobId?: string; employeeId?: string }) {
    const targetId = body.id || body.jobId || '';
    const ok = this.dataStore.markAsRead(targetId, body.employeeId);
    return { success: ok, id: targetId };
  }

  // 7. Ingest / Event Dispatch Endpoint
  @Post('events')
  async handleEvent(@Body() body: any) {
    return this.dataStore.broadcastOrDeliver({
      appCode: body.appCode || 'idesk',
      eventType: body.eventType || 'TICKET_ASSIGNED',
      employeeId: body.employeeId || '',
      siteCode: body.siteCode || body.site || 'ALL',
      ticketNumber: body.data?.ticketNumber || body.ticketNumber || 'TICKET-001',
      ticketTitle: body.data?.ticketTitle || body.ticketTitle || 'Pemberitahuan Sistem',
      priority: body.priority || 'NORMAL',
      actionUrl: body.action?.url || body.actionUrl,
    });
  }

  // 8. Dedicated Site Broadcast / Corporate Announcement
  @Post('broadcast')
  async handleBroadcast(@Body() body: {
    title: string;
    message: string;
    siteCode?: string; // SPJ, KRW, JTB, SMG, ALL
    priority?: string;
    actionUrl?: string;
    appCode?: string;
    deviceId?: string;
  }) {
    return this.dataStore.broadcastOrDeliver({
      appCode: body.appCode || 'sja',
      eventType: 'SYSTEM_BROADCAST',
      employeeId: '',
      siteCode: body.siteCode || 'ALL',
      ticketNumber: `BRD-${Date.now().toString().slice(-4)}`,
      ticketTitle: `${body.title}: ${body.message}`,
      priority: body.priority || 'NORMAL',
      actionUrl: body.actionUrl,
    });
  }
}
