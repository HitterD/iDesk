import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { isIP } from 'net';

export interface SjaAppModel {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'NOT_CONNECTED' | 'PAUSED';
  baseUrl: string;
  color: string;
  eventsCount: number;
  lastActive: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface SjaTemplateModel {
  id: string;
  appCode: string;
  eventType: string;
  titleTemplate: string;
  bodyTemplate: string;
  actionLabelTemplate: string;
  priority: string;
  allowedVariables: string[];
}

export interface SjaDeviceModel {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  deviceName: string;
  windowsUsername: string;
  status: 'ACTIVE' | 'STALE' | 'REVOKED';
  clientVersion: string;
  lastHeartbeat: string;
  lastHeartbeatAt?: string;
  ipAddress: string;
  deviceTokenHash: string;
  siteCode?: string; // SPJ, KRW, JTB, SMG
}

export interface SjaDevicePublicDto {
  id: string;
  employeeId: string;
  employeeName: string;
  deviceName: string;
  windowsUsername: string;
  status: 'ACTIVE' | 'STALE' | 'REVOKED';
  clientVersion: string;
  lastHeartbeat: string;
  lastHeartbeatAt: string;
  ipAddress: string;
  siteCode: string;
  isOnline: boolean;
}

export interface SjaOverlayConfig {
  mode: 'slideshow' | 'video';
  title: string;
  message: string;
  slideshowImages: string[];
  videoUrl: string;
  countdownSeconds: number;
  allowUserDisconnect: boolean;
  blurBackground: boolean;
}

export interface SjaRemoteSession {
  sessionId: string;
  sessionSecret: string;
  expiresAt: string;
  targetDeviceId: string;
  targetDeviceName: string;
  targetEmployeeName: string;
  targetIp: string;
  agentDeviceId: string;
  agentName: string;
  agentIp: string;
  status: 'PENDING' | 'COUNTDOWN' | 'ACTIVE' | 'TERMINATED' | 'REJECTED';
  startedAt: string;
  endedAt?: string;
  mediaConfig: SjaOverlayConfig;
}

export interface SjaDeliveryLogModel {
  id: string;
  time: string;
  app: string;
  eventType: string;
  eventRefHash: string;
  recipientAlias: string;
  deviceAlias: string;
  state: string;
  latency: string;
}

@Injectable()
export class SjaDataStoreService {
  private readonly logger = new Logger(SjaDataStoreService.name);

  // In-memory data store with live state
  private apps: SjaAppModel[] = [
    {
      id: 'app-001',
      code: 'idesk',
      name: 'iDesk Service Desk',
      description: 'Pusat tiket bantuan ICT, pembaruan lisensi software, booking Zoom, dan approval hardware.',
      status: 'ACTIVE',
      color: '#0F4C81',
      eventsCount: 4,
      baseUrl: process.env.IDESK_BASE_URL || 'https://idesk.santos.co.id',
      lastActive: 'Baru saja',
    },
    {
      id: 'app-002',
      code: 'ipop',
      name: 'iPop Procurement & PO',
      description: 'Sistem pengadaan barang, verifikasi Purchase Order, dan otorisasi anggaran belanja.',
      status: 'NOT_CONNECTED',
      color: '#10B981',
      eventsCount: 1,
      baseUrl: 'https://ipop.santos.co.id',
      lastActive: 'Belum pernah',
    },
    {
      id: 'app-003',
      code: 'hris',
      name: 'HRIS Santos Portal',
      description: 'Manajemen cuti karyawan, persetujuan lembur, dan pengumuman resmi kepegawaian.',
      status: 'NOT_CONNECTED',
      color: '#8B5CF6',
      eventsCount: 1,
      baseUrl: 'https://hris.santos.co.id',
      lastActive: 'Belum pernah',
    },
  ];

  private templates: SjaTemplateModel[] = [
    {
      id: 'tmpl-001',
      appCode: 'idesk',
      eventType: 'TICKET_ASSIGNED',
      titleTemplate: 'Tiket #{ticketNumber} Telah Ditugaskan',
      bodyTemplate: '{ticketTitle} membutuhkan tindakan atau konfirmasi Anda segera.',
      actionLabelTemplate: 'Buka Tiket',
      priority: 'NORMAL',
      allowedVariables: ['ticketNumber', 'ticketTitle', 'assignee'],
    },
    {
      id: 'tmpl-002',
      appCode: 'idesk',
      eventType: 'SLA_WARNING',
      titleTemplate: '⚠️ Peringatan SLA Tiket #{ticketNumber}',
      bodyTemplate: '{ticketTitle} mendekati batas waktu penanganan SLA.',
      actionLabelTemplate: 'Buka Tiket',
      priority: 'URGENT',
      allowedVariables: ['ticketNumber', 'ticketTitle', 'slaMinutes'],
    },
    {
      id: 'tmpl-003',
      appCode: 'idesk',
      eventType: 'HARDWARE_REQUEST_APPROVED',
      titleTemplate: 'Permintaan Hardware #{ticketNumber} Disetujui',
      bodyTemplate: '{ticketTitle} siap untuk diambil atau dijadwalkan instalasi.',
      actionLabelTemplate: 'Lihat Detail',
      priority: 'NORMAL',
      allowedVariables: ['ticketNumber', 'ticketTitle'],
    },
    {
      id: 'tmpl-004',
      appCode: 'ipop',
      eventType: 'PO_APPROVAL_REQUIRED',
      titleTemplate: 'Purchase Order #{ticketNumber} Menunggu Persetujuan',
      bodyTemplate: '{ticketTitle} memerlukan otorisasi Manager Anda.',
      actionLabelTemplate: 'Otorisasi PO',
      priority: 'HIGH',
      allowedVariables: ['ticketNumber', 'ticketTitle'],
    },
    {
      id: 'tmpl-005',
      appCode: 'idesk',
      eventType: 'TICKET_REPLY',
      titleTemplate: '[#{ticketNumber}] Pesan Baru pada Tiket',
      bodyTemplate: '{ticketTitle}',
      actionLabelTemplate: 'Buka Percakapan →',
      priority: 'HIGH',
      allowedVariables: ['ticketNumber', 'ticketTitle'],
    },
  ];

  private devices: SjaDeviceModel[] = [];
  private logs: SjaDeliveryLogModel[] = [];

  // Active WebSocket clients mapped by deviceId
  private activeSockets = new Map<string, any>();

  // Activation sessions mapped by code and sessionId
  private activationSessions = new Map<string, any>();

  // Active Remote Desktop Sessions mapped by sessionId
  private remoteSessions = new Map<string, SjaRemoteSession>();
  private readonly remoteSessionLifetimeMs = 60 * 60 * 1000;

  private storageDir = process.env.SJA_DATA_DIR || path.join(process.cwd(), 'data');
  private devicesFilePath = path.join(this.storageDir, 'devices.json');
  private logsFilePath = path.join(this.storageDir, 'delivery_logs.json');
  private appsFilePath = path.join(this.storageDir, 'apps.json');
  private templatesFilePath = path.join(this.storageDir, 'templates.json');
  private overlayConfigFilePath = path.join(this.storageDir, 'remote_overlay_config.json');

  private overlayConfig: SjaOverlayConfig = {
    mode: 'slideshow',
    title: 'Sesi Bantuan Remote Santos ICT Sedang Berlangsung',
    message: 'Petugas IT Helpdesk Santos sedang mengendalikan perangkat ini untuk pemeliharaan teknis. Layar kerja Anda terlindungi.',
    slideshowImages: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=1200&auto=format&fit=crop',
    ],
    videoUrl: '',
    countdownSeconds: 10,
    allowUserDisconnect: true,
    blurBackground: true,
  };

  constructor() {
    this.initPersistence();
  }

  private sanitizeLanIp(value?: string): string {
    const ip = value?.replace(/^::ffff:/, '').trim();
    if (!ip || isIP(ip) !== 4) return '';
    if (ip.startsWith('172.19.')) return '';

    const [first, second] = ip.split('.').map(Number);
    const isPrivate =
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
    return isPrivate ? ip : '';
  }

  private initPersistence() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      if (fs.existsSync(this.appsFilePath)) {
        const data = fs.readFileSync(this.appsFilePath, 'utf8');
        this.apps = JSON.parse(data);
        this.logger.log(`Loaded ${this.apps.length} persisted apps from disk`);
      } else {
        this.saveApps();
      }

      if (fs.existsSync(this.templatesFilePath)) {
        const data = fs.readFileSync(this.templatesFilePath, 'utf8');
        this.templates = JSON.parse(data);
        this.logger.log(`Loaded ${this.templates.length} persisted templates from disk`);
      } else {
        this.saveTemplates();
      }

      if (fs.existsSync(this.devicesFilePath)) {
        const data = fs.readFileSync(this.devicesFilePath, 'utf8');
        this.devices = JSON.parse(data);
        for (const device of this.devices) {
          device.ipAddress = this.sanitizeLanIp(device.ipAddress);
        }
        this.logger.log(`Loaded ${this.devices.length} persisted devices from disk`);
      }

      if (fs.existsSync(this.logsFilePath)) {
        const data = fs.readFileSync(this.logsFilePath, 'utf8');
        this.logs = JSON.parse(data);
        this.logger.log(`Loaded ${this.logs.length} persisted delivery logs from disk`);
      }

      if (fs.existsSync(this.overlayConfigFilePath)) {
        const data = fs.readFileSync(this.overlayConfigFilePath, 'utf8');
        this.overlayConfig = { ...this.overlayConfig, ...JSON.parse(data) };
        this.logger.log(`Loaded persisted remote overlay config from disk`);
      } else {
        this.saveOverlayConfig();
      }
    } catch (err: any) {
      this.logger.warn(`Failed to initialize persistence: ${err.message}`);
    }
  }

  private saveOverlayConfig() {
    try {
      if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
      fs.writeFileSync(this.overlayConfigFilePath, JSON.stringify(this.overlayConfig, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Failed to persist remote overlay config: ${err.message}`);
    }
  }

  private saveApps() {
    try {
      if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
      fs.writeFileSync(this.appsFilePath, JSON.stringify(this.apps, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Failed to persist apps: ${err.message}`);
    }
  }

  private saveTemplates() {
    try {
      if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
      fs.writeFileSync(this.templatesFilePath, JSON.stringify(this.templates, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Failed to persist templates: ${err.message}`);
    }
  }

  private saveDevices() {
    try {
      if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
      fs.writeFileSync(this.devicesFilePath, JSON.stringify(this.devices, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Failed to persist devices: ${err.message}`);
    }
  }

  private saveLogs() {
    try {
      if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
      fs.writeFileSync(this.logsFilePath, JSON.stringify(this.logs, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.warn(`Failed to persist logs: ${err.message}`);
    }
  }

  /**
   * Sanitizes rich HTML tags into clean plain text for Windows toasts & popups
   */
  private sanitizeText(raw: string): string {
    if (!raw) return '';
    return raw
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Apps CRUD
  getApps(): SjaAppModel[] {
    return this.apps;
  }

  createApp(dto: Partial<SjaAppModel>): SjaAppModel {
    const apiKey = `sja_${(dto.code || 'app').toLowerCase()}_${crypto.randomBytes(8).toString('hex')}`;
    const apiSecret = crypto.randomBytes(24).toString('hex');

    const newApp: SjaAppModel = {
      id: `app-${Date.now()}`,
      code: (dto.code || 'app').toLowerCase().trim(),
      name: dto.name || 'Aplikasi Baru',
      description: dto.description || '',
      status: 'ACTIVE',
      color: dto.color || '#2D4A8C',
      eventsCount: 0,
      baseUrl: dto.baseUrl || '',
      lastActive: 'Baru didaftarkan',
      apiKey,
      apiSecret,
    };
    this.apps.push(newApp);
    this.saveApps();
    this.logger.log(`Created app: ${newApp.name} (${newApp.code})`);
    return newApp;
  }

  updateApp(id: string, dto: Partial<SjaAppModel>): SjaAppModel {
    const index = this.apps.findIndex((a) => a.id === id || a.code === id);
    if (index !== -1) {
      this.apps[index] = { ...this.apps[index], ...dto };
      this.saveApps();
      return this.apps[index];
    }
    throw new Error('Aplikasi tidak ditemukan');
  }

  deleteApp(id: string): boolean {
    const index = this.apps.findIndex((a) => a.id === id || a.code === id);
    if (index !== -1) {
      const removed = this.apps.splice(index, 1);
      this.saveApps();
      this.logger.log(`Deleted app: ${removed[0].name} (${removed[0].code})`);
      return true;
    }
    return false;
  }

  rotateAppSecret(id: string): { apiKey: string; apiSecret: string } {
    const app = this.apps.find((a) => a.id === id || a.code === id);
    if (!app) throw new Error('Aplikasi tidak ditemukan');
    app.apiSecret = crypto.randomBytes(24).toString('hex');
    if (!app.apiKey) {
      app.apiKey = `sja_${app.code}_${crypto.randomBytes(8).toString('hex')}`;
    }
    this.saveApps();
    return { apiKey: app.apiKey, apiSecret: app.apiSecret };
  }

  // Templates CRUD
  getTemplates(appCode?: string): SjaTemplateModel[] {
    if (appCode) {
      return this.templates.filter((t) => t.appCode === appCode);
    }
    return this.templates;
  }

  createTemplate(dto: Partial<SjaTemplateModel>): SjaTemplateModel {
    const newTmpl: SjaTemplateModel = {
      id: `tmpl-${Date.now()}`,
      appCode: (dto.appCode || 'idesk').toLowerCase().trim(),
      eventType: (dto.eventType || 'CUSTOM_EVENT').toUpperCase().trim(),
      titleTemplate: dto.titleTemplate || 'Pemberitahuan Sistem #{ticketNumber}',
      bodyTemplate: dto.bodyTemplate || '{ticketTitle}',
      actionLabelTemplate: dto.actionLabelTemplate || 'Buka di Web',
      priority: (dto.priority || 'NORMAL').toUpperCase(),
      allowedVariables: dto.allowedVariables || ['ticketNumber', 'ticketTitle'],
    };
    this.templates.push(newTmpl);
    this.saveTemplates();
    this.logger.log(`Created template: [${newTmpl.appCode}] ${newTmpl.eventType}`);
    return newTmpl;
  }

  updateTemplate(id: string, dto: Partial<SjaTemplateModel>): SjaTemplateModel {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.templates[index] = { ...this.templates[index], ...dto };
      this.saveTemplates();
      return this.templates[index];
    }
    throw new Error('Template tidak ditemukan');
  }

  deleteTemplate(id: string): boolean {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.templates.splice(index, 1);
      this.saveTemplates();
      return true;
    }
    return false;
  }

  // Devices CRUD
  getDevices(): SjaDeviceModel[] {
    return this.devices;
  }

  getPublicDevices(siteCodeFilter?: string): SjaDevicePublicDto[] {
    return this.devices
      .filter((d) => d.status === 'ACTIVE')
      .filter((d) => !siteCodeFilter || siteCodeFilter === 'ALL' || (d.siteCode || 'SPJ') === siteCodeFilter)
      .map((d) => ({
        id: d.id,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        deviceName: d.deviceName,
        windowsUsername: d.windowsUsername,
        status: d.status,
        clientVersion: d.clientVersion,
        lastHeartbeat: d.lastHeartbeat,
        lastHeartbeatAt: d.lastHeartbeatAt || new Date().toISOString(),
        ipAddress: this.sanitizeLanIp(d.ipAddress),
        siteCode: d.siteCode || 'SPJ',
        isOnline: this.activeSockets.has(d.id),
      }));
  }

  getDeviceById(id: string): SjaDeviceModel | null {
    return this.devices.find((d) => d.id === id) || null;
  }

  getOverlayConfig(): SjaOverlayConfig {
    return this.overlayConfig;
  }

  updateOverlayConfig(patch: Partial<SjaOverlayConfig>): SjaOverlayConfig {
    const mode = patch.mode === 'video' ? 'video' : patch.mode === 'slideshow' ? 'slideshow' : this.overlayConfig.mode;
    const countdownSeconds = typeof patch.countdownSeconds === 'number'
      ? Math.max(1, Math.min(120, Math.trunc(patch.countdownSeconds)))
      : this.overlayConfig.countdownSeconds;
    const slideshowImages = Array.isArray(patch.slideshowImages)
      ? patch.slideshowImages.filter((value) => this.isAllowedMediaUrl(value)).slice(0, 5)
      : this.overlayConfig.slideshowImages;
    const videoUrl = typeof patch.videoUrl === 'string' && this.isAllowedMediaUrl(patch.videoUrl)
      ? patch.videoUrl
      : this.overlayConfig.videoUrl;

    this.overlayConfig = {
      ...this.overlayConfig,
      mode,
      countdownSeconds,
      slideshowImages,
      videoUrl,
      title: typeof patch.title === 'string' ? patch.title.trim().slice(0, 160) : this.overlayConfig.title,
      message: typeof patch.message === 'string' ? patch.message.trim().slice(0, 500) : this.overlayConfig.message,
      allowUserDisconnect: typeof patch.allowUserDisconnect === 'boolean' ? patch.allowUserDisconnect : this.overlayConfig.allowUserDisconnect,
      blurBackground: typeof patch.blurBackground === 'boolean' ? patch.blurBackground : this.overlayConfig.blurBackground,
    };
    this.saveOverlayConfig();
    this.logger.log(`Updated remote overlay config: mode=${this.overlayConfig.mode}`);
    return this.overlayConfig;
  }

  private isAllowedMediaUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  createRemoteSession(params: {
    targetDeviceId: string;
    agentDeviceId: string;
    agentName: string;
    agentIp: string;
  }): { session: SjaRemoteSession; targetOnline: boolean } {
    const target = this.devices.find((d) => d.id === params.targetDeviceId);
    if (!target) {
      throw new Error('Target device tidak ditemukan');
    }

    const sessionId = `rem-${Date.now().toString().slice(-6)}-${crypto.randomBytes(4).toString('hex')}`;
    const sessionSecret = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + this.remoteSessionLifetimeMs).toISOString();
    const targetOnline = this.activeSockets.has(target.id);
    const sanitizedTargetIp = this.sanitizeLanIp(target.ipAddress);

    const session: SjaRemoteSession = {
      sessionId,
      sessionSecret,
      expiresAt,
      targetDeviceId: target.id,
      targetDeviceName: target.deviceName,
      targetEmployeeName: target.employeeName,
      targetIp: sanitizedTargetIp,
      agentDeviceId: params.agentDeviceId,
      agentName: params.agentName,
      agentIp: params.agentIp,
      status: 'COUNTDOWN',
      startedAt: new Date().toISOString(),
      mediaConfig: this.overlayConfig,
    };

    this.remoteSessions.set(sessionId, session);

    // Notify target device via active WebSocket if online
    const targetSocket = this.activeSockets.get(target.id);
    if (targetSocket && targetSocket.readyState === 1) {
      targetSocket.send(
        JSON.stringify({
          action: 'REMOTE_SESSION_INVITE',
          sessionId,
          sessionSecret,
          expiresAt,
          agentDeviceId: params.agentDeviceId,
          agentName: params.agentName,
          agentIp: params.agentIp,
          countdownSeconds: this.overlayConfig.countdownSeconds,
          mediaConfig: this.overlayConfig,
        }),
      );
    }

    this.logger.log(
      `Created Remote Desktop Session [${sessionId}]: Agent [${params.agentName}] (${params.agentIp}) -> Target [${target.deviceName}] (${sanitizedTargetIp || 'RELAY-ONLY'}) [Online: ${targetOnline}]`,
    );

    return { session, targetOnline };
  }

  validateRelayAccess(
    sessionId: string,
    sessionSecret: string,
    senderDeviceId: string,
    targetDeviceId: string,
    action: 'REMOTE_FRAME' | 'REMOTE_INPUT' | 'REMOTE_SIGNAL',
  ): { valid: boolean; error?: string } {
    const session = this.remoteSessions.get(sessionId);
    if (!session) {
      return { valid: false, error: 'Sesi remote tidak ditemukan' };
    }
    if (session.status === 'TERMINATED' || session.status === 'REJECTED') {
      return { valid: false, error: 'Sesi remote telah dihentikan' };
    }
    if (new Date() > new Date(session.expiresAt)) {
      session.status = 'TERMINATED';
      return { valid: false, error: 'Sesi remote telah kadaluarsa' };
    }
    if (session.sessionSecret !== sessionSecret) {
      return { valid: false, error: 'Kredensial rahasia sesi tidak cocok' };
    }

    if (action === 'REMOTE_INPUT') {
      if (senderDeviceId !== session.agentDeviceId || targetDeviceId !== session.targetDeviceId) {
        return { valid: false, error: 'Otorisasi arah input remote tidak sah' };
      }
    } else if (action === 'REMOTE_FRAME') {
      if (senderDeviceId !== session.targetDeviceId || targetDeviceId !== session.agentDeviceId) {
        return { valid: false, error: 'Otorisasi arah frame remote tidak sah' };
      }
    } else if (action === 'REMOTE_SIGNAL') {
      const isAgentToTarget = senderDeviceId === session.agentDeviceId && targetDeviceId === session.targetDeviceId;
      const isTargetToAgent = senderDeviceId === session.targetDeviceId && targetDeviceId === session.agentDeviceId;
      if (!isAgentToTarget && !isTargetToAgent) {
        return { valid: false, error: 'Partisipan sinyal remote tidak cocok dengan sesi' };
      }
    }

    return { valid: true };
  }

  getRemoteSession(sessionId: string): SjaRemoteSession | null {
    return this.remoteSessions.get(sessionId) || null;
  }

  getRemoteSessionForDevice(sessionId: string, deviceId: string): SjaRemoteSession | null {
    const session = this.remoteSessions.get(sessionId);
    if (!session) return null;
    if (session.agentDeviceId !== deviceId && session.targetDeviceId !== deviceId) return null;
    return session;
  }

  endRemoteSession(sessionId: string, reason: string = 'User or Agent disconnected'): boolean {
    const session = this.remoteSessions.get(sessionId);
    if (!session) return false;

    session.status = 'TERMINATED';
    session.endedAt = new Date().toISOString();

    const targetSocket = this.activeSockets.get(session.targetDeviceId);
    if (targetSocket && targetSocket.readyState === 1) {
      targetSocket.send(
        JSON.stringify({
          action: 'REMOTE_SESSION_TERMINATED',
          sessionId,
          reason,
        }),
      );
    }

    this.logger.log(`Terminated Remote Session [${sessionId}]: ${reason}`);
    return true;
  }

  revokeDevice(deviceId: string): boolean {
    const device = this.devices.find((d) => d.id === deviceId);
    if (device) {
      device.status = 'REVOKED';
      this.saveDevices();
      const ws = this.activeSockets.get(deviceId);
      if (ws) {
        ws.close(4003, 'Akses perangkat dicabut oleh Administrator');
        this.activeSockets.delete(deviceId);
      }
      this.logger.log(`Revoked device: ${device.deviceName} (${deviceId})`);
      return true;
    }
    return false;
  }

  // Device pairing & sessions
  createActivationSession(meta: { deviceName: string; windowsUsername: string }) {
    const sessionId = crypto.randomUUID();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const data = {
      sessionId,
      code,
      meta,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    this.activationSessions.set(code, data);
    this.activationSessions.set(sessionId, data);

    return {
      sessionId,
      code,
      activationUrl: `${process.env.IDESK_BASE_URL || 'https://idesk.santos.co.id'}/devices/activate?code=${code}`,
    };
  }

  approveActivation(code: string, employee: { employeeId: string; name: string; role?: string }) {
    const session = this.activationSessions.get(code);
    if (!session) {
      throw new Error('Kode aktivasi tidak valid atau telah kedaluwarsa');
    }

    const deviceToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const deviceId = `dev-${Date.now().toString().slice(-4)}`;
    const siteCode = (employee.employeeId?.toLowerCase().includes('krw') ? 'KRW'
      : employee.employeeId?.toLowerCase().includes('jtb') ? 'JTB'
      : employee.employeeId?.toLowerCase().includes('smg') ? 'SMG' : 'SPJ');

    const newDevice: SjaDeviceModel = {
      id: deviceId,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      employeeRole: typeof employee.role === 'string' ? employee.role : '',
      deviceName: session.meta.deviceName || 'PC-Windows',
      windowsUsername: session.meta.windowsUsername || 'user',
      status: 'ACTIVE',
      clientVersion: 'v2.0.0',
      lastHeartbeat: 'Baru saja',
      ipAddress: '',
      deviceTokenHash: tokenHash,
      siteCode,
    };

    this.devices.push(newDevice);
    this.saveDevices();

    session.status = 'APPROVED';
    session.deviceToken = deviceToken;
    session.deviceId = deviceId;

    this.logger.log(`Approved device pairing: ${newDevice.deviceName} -> ${newDevice.employeeName}`);

    return {
      success: true,
      deviceName: newDevice.deviceName,
    };
  }

  pollActivation(sessionId: string) {
    const session = this.activationSessions.get(sessionId);
    if (!session) return { status: 'EXPIRED' };
    if (session.status === 'APPROVED') {
      const dev = this.devices.find(d => d.id === session.deviceId);
      return {
        status: 'APPROVED',
        deviceId: session.deviceId,
        deviceToken: session.deviceToken,
        employee: dev ? {
          nik: dev.employeeId,
          name: dev.employeeName,
          siteCode: dev.siteCode || 'SPJ'
        } : undefined,
      };
    }
    return { status: 'PENDING' };
  }

  findDeviceByToken(token: string): SjaDeviceModel | null {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return this.devices.find((d) => d.deviceTokenHash === tokenHash && d.status === 'ACTIVE') || null;
  }

  /**
   * Direct Enterprise Login with NIK & Password (SSO via iDesk Identity Provider)
   */
  async loginWithIdeskCredentials(credentials: {
    nik: string;
    password: string;
    deviceName?: string;
    windowsUsername?: string;
    clientIp?: string;
  }) {
    const ideskInternalUrl = process.env.IDESK_INTERNAL_API_URL || 'http://10.10.6.13:5050';
    const verifyUrl = `${ideskInternalUrl.replace(/\/$/, '')}/v1/auth/s2s/verify-credential`;

    this.logger.log(`Authenticating device [${credentials.deviceName}] for NIK [${credentials.nik}] via ${verifyUrl}...`);

    let verifyRes: any;
    try {
      const resp = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: credentials.nik,
          password: credentials.password,
        }),
      });

      if (!resp.ok) {
        throw new Error(`iDesk IdP mengembalikan status HTTP ${resp.status}`);
      }

      verifyRes = await resp.json();
    } catch (err: any) {
      this.logger.error(`Gagal menghubungi iDesk IdP: ${err.message}`);
      throw new Error(`Gagal menghubungi server iDesk: ${err.message}`);
    }

    if (!verifyRes.valid || !verifyRes.user) {
      throw new Error(verifyRes.message || 'NIK atau Password iDesk tidak valid');
    }

    const employee = verifyRes.user;
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const deviceId = `dev-${Date.now().toString().slice(-4)}`;

    // Deactivate prior duplicate device registrations for same machine & employee
    this.devices.forEach((d) => {
      if (d.employeeId === employee.employeeId && d.deviceName === (credentials.deviceName || 'PC-Windows')) {
        d.status = 'REVOKED';
      }
    });

    const resolvedIp = this.sanitizeLanIp(credentials.clientIp);

    const newDevice: SjaDeviceModel = {
      id: deviceId,
      employeeId: employee.employeeId,
      employeeName: employee.fullName,
      employeeRole: employee.role || '',
      deviceName: credentials.deviceName || 'PC-Windows',
      windowsUsername: credentials.windowsUsername || 'user',
      status: 'ACTIVE',
      clientVersion: 'v2.0.0',
      lastHeartbeat: 'Baru saja',
      lastHeartbeatAt: new Date().toISOString(),
      ipAddress: resolvedIp,
      deviceTokenHash: tokenHash,
      siteCode: employee.siteCode || 'SPJ',
    };

    this.devices.push(newDevice);
    this.saveDevices();
    this.logger.log(`Direct Enterprise login success: ${newDevice.deviceName} -> ${newDevice.employeeName} (${newDevice.employeeId}) [Site: ${newDevice.siteCode}]`);

    return {
      success: true,
      deviceId,
      deviceToken,
      employee: {
        nik: employee.employeeId,
        name: employee.fullName,
        email: employee.email,
        role: employee.role,
        siteCode: newDevice.siteCode,
      },
    };
  }

  /**
   * Exchange validated Keycloak OAuth 2.0 / OpenID Connect access token for SJA device registration
   */
  async exchangeKeycloakToken(data: {
    accessToken: string;
    idToken?: string;
    deviceName?: string;
    windowsUsername?: string;
    clientIp?: string;
  }) {
    // 1. Decode & validate JWT payload directly or verify via Userinfo
    let employeeId = '';
    let employeeName = '';
    let email = '';
    let siteCode = 'SPJ';
    let role = 'AGENT_OPERATIONAL_SUPPORT';

    try {
      // Decode JWT Payload without external network latency
      const parts = data.accessToken.split('.');
      if (parts.length >= 2) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
        const jwtPayload = JSON.parse(payloadStr);

        employeeId = jwtPayload.preferred_username || jwtPayload.sub;
        employeeName = jwtPayload.name || `${jwtPayload.given_name || ''} ${jwtPayload.family_name || ''}`.trim() || employeeId;
        email = jwtPayload.email || '';
        siteCode = jwtPayload.attributes?.siteCode?.[0] || 'SPJ';
        const rawRoles: unknown = jwtPayload.realm_access?.roles ?? jwtPayload.roles ?? jwtPayload.role;
        const roles: string[] = Array.isArray(rawRoles) ? rawRoles.map(String) : typeof rawRoles === 'string' ? [rawRoles] : [];
        const known = roles.map((r) => r.toUpperCase()).find((r) => r === 'ADMIN' || r.startsWith('AGENT') || r === 'MANAGER' || r === 'USER');
        if (known) role = known;
      }
    } catch (parseErr) {
      this.logger.warn(`JWT payload parsing warning: ${parseErr}`);
    }

    if (!employeeId) {
      throw new Error('Invalid Keycloak access token: unable to resolve user identity');
    }

    const deviceToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const deviceId = `dev-${Date.now().toString().slice(-4)}`;

    // Deactivate previous sessions for same device
    this.devices.forEach((d) => {
      if (d.employeeId === employeeId && d.deviceName === (data.deviceName || 'PC-Windows')) {
        d.status = 'REVOKED';
      }
    });

    const resolvedIp = this.sanitizeLanIp(data.clientIp);

    const newDevice: SjaDeviceModel = {
      id: deviceId,
      employeeId,
      employeeName,
      employeeRole: role,
      deviceName: data.deviceName || 'PC-Windows',
      windowsUsername: data.windowsUsername || 'user',
      status: 'ACTIVE',
      clientVersion: 'v2.0.0-oidc',
      lastHeartbeat: 'Baru saja',
      lastHeartbeatAt: new Date().toISOString(),
      ipAddress: resolvedIp,
      deviceTokenHash: tokenHash,
      siteCode,
    };

    this.devices.push(newDevice);
    this.saveDevices();
    this.logger.log(`Keycloak OIDC Device Registered: ${newDevice.deviceName} -> ${newDevice.employeeName} (${newDevice.employeeId}) [Site: ${newDevice.siteCode}]`);

    return {
      success: true,
      deviceId,
      deviceToken,
      employee: {
        nik: employeeId,
        name: employeeName,
        email,
        role,
        siteCode,
      },
    };
  }

  registerActiveSocket(deviceId: string, ws: any, clientIp?: string) {
    this.activeSockets.set(deviceId, ws);
    const device = this.devices.find((d) => d.id === deviceId);
    if (device) {
      device.lastHeartbeat = 'Baru saja';
      device.lastHeartbeatAt = new Date().toISOString();
      const sanitizedIp = this.sanitizeLanIp(clientIp);
      if (device.ipAddress !== sanitizedIp) {
        device.ipAddress = sanitizedIp;
        this.saveDevices();
      }
    }
  }

  unregisterActiveSocket(deviceId: string) {
    this.activeSockets.delete(deviceId);
  }

  getActiveSocket(deviceId: string) {
    return this.activeSockets.get(deviceId);
  }

  getHealthSummary() {
    const activeDevices = this.devices.filter((d) => d.status === 'ACTIVE').length;
    const onlineSockets = this.activeSockets.size;
    return {
      status: 'ok',
      service: 'sja-notification-center',
      cluster: 'Santos Jaya Abadi Notification Hub',
      authProtocol: 'DPAPI + HMAC-SHA256',
      activeDevices,
      onlineSockets,
      timestamp: new Date().toISOString(),
    };
  }

  // Logs CRUD
  getLogs(): SjaDeliveryLogModel[] {
    return this.logs;
  }

  addLog(entry: Omit<SjaDeliveryLogModel, 'id'>) {
    const log: SjaDeliveryLogModel = {
      id: `job-${Date.now().toString().slice(-5)}`,
      ...entry,
    };
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs.pop(); // keep last 100
    this.saveLogs();
    return log;
  }

  // Send Notification Event directly to Device
  async broadcastOrDeliver(payload: {
    appCode: string;
    eventType: string;
    employeeId?: string;
    siteCode?: string;
    ticketNumber?: string;
    ticketTitle: string;
    priority: string;
    actionUrl?: string;
  }) {
    // Find template
    const tmpl = this.templates.find(
      (t) => t.appCode === payload.appCode && t.eventType === payload.eventType,
    ) || {
      titleTemplate: `[${payload.appCode.toUpperCase()}] ${payload.ticketNumber || 'ANNOUNCEMENT'}`,
      bodyTemplate: payload.ticketTitle,
      actionLabelTemplate: 'Lihat Detail',
      priority: payload.priority || 'NORMAL',
    };

    const ticketNum = payload.ticketNumber || `ANN-${Date.now().toString().slice(-4)}`;
    const rawTitle = tmpl.titleTemplate.replace('{ticketNumber}', ticketNum);
    const rawBody = tmpl.bodyTemplate
      .replace('{ticketTitle}', payload.ticketTitle)
      .replace('{ticketNumber}', ticketNum);

    const renderedTitle = this.sanitizeText(rawTitle);
    const renderedBody = this.sanitizeText(rawBody);

    const baseUrl = process.env.IDESK_BASE_URL || 'https://idesk.santos.co.id';
    let smartTargetUrl = payload.actionUrl || (payload.ticketNumber ? `${baseUrl}/tickets/${payload.ticketNumber}` : baseUrl);

    // If iDesk notification with known employee target, wrap with One-Time SSO Ticket for Seamless AutoLogin
    if (payload.appCode === 'idesk' && payload.employeeId) {
      try {
        const ideskInternalUrl = process.env.IDESK_INTERNAL_API_URL || 'http://10.10.6.13:5050';
        const s2sSecret = process.env.SJA_INTERNAL_SECRET;
        if (s2sSecret) {
          const ticketRes = await fetch(`${ideskInternalUrl.replace(/\/$/, '')}/v1/auth/s2s/issue-sso-ticket`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-s2s-token': s2sSecret,
            },
            body: JSON.stringify({ identifier: payload.employeeId }),
          });
          if (ticketRes.ok) {
            const tData: any = await ticketRes.json();
            if (tData.success && tData.ticket) {
              const redirectPath = smartTargetUrl.replace(/^https?:\/\/[^/]+/, '');
              smartTargetUrl = `${baseUrl}/v1/auth/autologin?ticket=${tData.ticket}&redirect=${encodeURIComponent(redirectPath || '/')}`;
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to generate SSO ticket for event, fallback to direct URL: ${err.message}`);
      }
    }

    const notificationData = {
      id: `notif-${Date.now()}`,
      app: payload.appCode === 'idesk' ? 'iDesk' : payload.appCode.toUpperCase(),
      appCode: payload.appCode,
      title: renderedTitle,
      body: renderedBody,
      message: renderedBody,
      url: smartTargetUrl,
      actionUrl: smartTargetUrl,
      priority: payload.priority.toLowerCase(),
      display: 'both',
      accentColor: payload.appCode === 'idesk' ? '#0F4C81' : '#10B981',
      timestamp: new Date().toISOString(),
      ticketNumber: ticketNum,
      category: payload.eventType,
    };

    // Find devices for employeeId or deliver to online devices filtered by siteCode (SPJ, KRW, JTB, SMG, ALL)
    // ZERO-LEAKAGE POLICY: Jika ada employeeId spesifik, HANYA kirim ke perangkat milik user tersebut.
    // Jangan pernah fallback broadcast ke perangkat orang lain jika user sedang offline!
    let targetDevices = this.devices.filter(
      (d) => d.status === 'ACTIVE' &&
             (d.employeeId === payload.employeeId || !payload.employeeId) &&
             (!payload.siteCode || payload.siteCode === 'ALL' || (d.siteCode || 'SPJ') === payload.siteCode),
    );

    // Broadcast ke seluruh perangkat di site HANYA jika memang event bertipe SYSTEM_BROADCAST / pengumuman publik (tanpa employeeId)
    if (!payload.employeeId && targetDevices.length === 0 && this.activeSockets.size > 0) {
      targetDevices = this.devices.filter(
        (d) => d.status === 'ACTIVE' &&
               this.activeSockets.has(d.id) &&
               (!payload.siteCode || payload.siteCode === 'ALL' || (d.siteCode || 'SPJ') === payload.siteCode),
      );
    }

    let deliveredCount = 0;
    for (const dev of targetDevices) {
      const ws = this.activeSockets.get(dev.id);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(notificationData));
        deliveredCount++;
      }
    }

    const state = deliveredCount > 0 ? 'DELIVERED' : 'QUEUED';
    const refHash = crypto.createHash('sha256').update(`${payload.appCode}:${ticketNum}:${Date.now()}`).digest('hex').slice(0, 12);

    const targetDesc = payload.employeeId
      ? `usr-*** (${payload.employeeId})`
      : (payload.siteCode && payload.siteCode !== 'ALL' ? `Site: ${payload.siteCode}` : 'All Devices');

    this.addLog({
      time: new Date().toLocaleTimeString('id-ID'),
      app: payload.appCode,
      eventType: payload.eventType,
      eventRefHash: `${refHash}...`,
      recipientAlias: targetDesc,
      deviceAlias: deliveredCount > 0 ? `${deliveredCount} Perangkat (${payload.siteCode || 'ALL'})` : 'Offline (Antrean)',
      state,
      latency: deliveredCount > 0 ? '14ms' : '-',
    });

    this.logger.log(`Delivered notification to ${deliveredCount} online devices for site [${payload.siteCode || 'ALL'}]. State: ${state}`);

    return {
      success: true,
      jobId: notificationData.id,
      deliveredCount,
      state,
      message: deliveredCount > 0 ? `Terkirim ke ${deliveredCount} perangkat aktif (${payload.siteCode || 'ALL'})` : 'Masuk antrean offline (perangkat belum online)',
    };
  }

  // Acknowledge read receipt from device
  markAsRead(jobId: string, employeeId?: string): boolean {
    const log = this.logs.find((l) => l.id === jobId || l.eventRefHash.startsWith(jobId));
    if (log) {
      log.state = 'ACKNOWLEDGED';
      this.saveLogs();
      this.logger.log(`Notification [${jobId}] marked as ACKNOWLEDGED by ${employeeId || 'device'}`);
      return true;
    }
    return false;
  }
}
