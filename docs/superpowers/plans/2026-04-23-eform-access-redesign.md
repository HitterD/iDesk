# E-Form Access Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework E-Form Access halaman menjadi Modern Compact layout, approval 1 level (user → atasan → ICT), atasan dropdown dari semua user DB, halaman kredensial ICT-only + requester.

**Architecture:** Backend service disederhanakan dari 2-level manager menjadi 1-level. Frontend layout diganti dari 3-section card ke single compact form. Dua halaman baru: EformApprovalPage (atasan) dan EformCredentialPage (ICT + requester).

**Tech Stack:** NestJS + TypeORM (backend), React + TanStack Query + Tailwind (frontend), TypeScript

---

## File Map

### Backend — Modify
- `apps/backend/src/modules/eform-request/entities/eform-request.entity.ts` — update EFormStatus enum
- `apps/backend/src/modules/eform-request/entities/eform-credential.entity.ts` — add vpnServer, notes columns
- `apps/backend/src/modules/eform-request/dto/create-eform-request.dto.ts` — add requesterName, requesterDepartment
- `apps/backend/src/modules/eform-request/dto/approve-manager1.dto.ts` — remove nextApproverId, rename
- `apps/backend/src/modules/eform-request/dto/index.ts` — re-export renamed DTO
- `apps/backend/src/modules/eform-request/eform-request.service.ts` — refactor approval flow
- `apps/backend/src/modules/eform-request/eform-request.controller.ts` — update endpoints
- `apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts` — update events

### Backend — Create
- `apps/backend/src/modules/eform-request/dto/submit-credential.dto.ts` — ICT credential submission DTO

### Frontend — Modify
- `apps/frontend/src/features/request-center/api/eform-request.api.ts` — update/add hooks
- `apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx` — fetch all users
- `apps/frontend/src/features/request-center/components/eform/SignaturePad.tsx` — show nama terang + tanggal
- `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx` — full rework
- `apps/frontend/src/routes/AppRoutes.tsx` — add 2 new routes (3 layout groups)

### Frontend — Create
- `apps/frontend/src/features/request-center/pages/EformApprovalPage.tsx` — manager review + TTD
- `apps/frontend/src/features/request-center/pages/EformCredentialPage.tsx` — ICT input + user view

---

## Task 1: Backend — Update EFormStatus Enum

**Files:**
- Modify: `apps/backend/src/modules/eform-request/entities/eform-request.entity.ts`

- [ ] **Step 1: Update enum in eform-request.entity.ts**

```typescript
// apps/backend/src/modules/eform-request/entities/eform-request.entity.ts
// Replace the EFormStatus enum block:

export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER',
  PENDING_ICT = 'PENDING_ICT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
}
```

> Note: Removes `PENDING_MANAGER_1` dan `PENDING_MANAGER_2`. Jika ada data live di DB, jalankan dulu:
> `ALTER TYPE eform_status RENAME VALUE 'PENDING_MANAGER_1' TO 'PENDING_MANAGER';`
> `ALTER TYPE eform_status DROP VALUE 'PENDING_MANAGER_2';`

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/eform-request/entities/eform-request.entity.ts
git commit -m "feat(eform): simplify status enum to single-manager flow"
```

---

## Task 2: Backend — Add vpnServer + notes to EFormCredential Entity

**Files:**
- Modify: `apps/backend/src/modules/eform-request/entities/eform-credential.entity.ts`

- [ ] **Step 1: Add vpnServer and notes columns**

```typescript
// apps/backend/src/modules/eform-request/entities/eform-credential.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_credentials')
export class EFormCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column({ type: 'text' })
  encryptedUsername: string;

  @Column({ type: 'text' })
  encryptedPassword: string;

  @Column()
  iv: string;

  @Column()
  authTag: string;

  @Column({ type: 'varchar', nullable: true })
  vpnServer: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column()
  provisionedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provisionedById' })
  provisionedBy: User;

  @CreateDateColumn()
  provisionedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessCreatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessExpiresAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/eform-request/entities/eform-credential.entity.ts
git commit -m "feat(eform): add vpnServer and notes fields to EFormCredential"
```

---

## Task 3: Backend — DTO Updates

**Files:**
- Modify: `apps/backend/src/modules/eform-request/dto/create-eform-request.dto.ts`
- Modify: `apps/backend/src/modules/eform-request/dto/approve-manager1.dto.ts`
- Create: `apps/backend/src/modules/eform-request/dto/submit-credential.dto.ts`
- Modify: `apps/backend/src/modules/eform-request/dto/index.ts`

- [ ] **Step 1: Update CreateEFormRequestDto — add editable name + dept**

```typescript
// apps/backend/src/modules/eform-request/dto/create-eform-request.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUUID, IsEnum } from 'class-validator';
import { EFormType } from '../entities/eform-request.entity';

export class CreateEFormRequestDto {
  @IsEnum(EFormType)
  @IsNotEmpty()
  formType: EFormType;

  @IsString()
  @IsOptional()
  requesterName?: string;

  @IsString()
  @IsOptional()
  requesterDepartment?: string;

  @IsObject()
  @IsNotEmpty()
  formData: any;

  @IsString()
  @IsOptional()
  requestedWebsites?: string;

  @IsString()
  @IsOptional()
  networkPurpose?: string;

  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsString()
  @IsNotEmpty()
  signatureData: string;

  @IsUUID()
  @IsNotEmpty()
  managerId: string;
}
```

- [ ] **Step 2: Simplify ApproveManager1Dto — remove nextApproverId**

```typescript
// apps/backend/src/modules/eform-request/dto/approve-manager1.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ApproveManagerDto {
  @IsString()
  @IsNotEmpty()
  signatureData: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsNotEmpty()
  action: 'APPROVE' | 'REJECT';
}
```

- [ ] **Step 3: Create SubmitCredentialDto**

```typescript
// apps/backend/src/modules/eform-request/dto/submit-credential.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitCredentialDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  vpnServer?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

- [ ] **Step 4: Update dto/index.ts**

```typescript
// apps/backend/src/modules/eform-request/dto/index.ts
export { CreateEFormRequestDto } from './create-eform-request.dto';
export { ApproveManagerDto } from './approve-manager1.dto';
export { SubmitCredentialDto } from './submit-credential.dto';
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/eform-request/dto/
git commit -m "feat(eform): update DTOs for single-manager flow and credential submission"
```

---

## Task 4: Backend — Refactor Service

**Files:**
- Modify: `apps/backend/src/modules/eform-request/eform-request.service.ts`

- [ ] **Step 1: Replace full service file**

```typescript
// apps/backend/src/modules/eform-request/eform-request.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EFormRequest, EFormStatus, EFormApproval, EFormSignature, EFormCredential } from './entities';
import { EFormCredentialService } from './eform-credential.service';
import { CreateEFormRequestDto, ApproveManagerDto, SubmitCredentialDto } from './dto';
import { EFormPdfService } from './eform-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { UserRole } from '../users/enums/user-role.enum';

const ICT_ROLES = [UserRole.ADMIN, UserRole.AGENT_ADMIN];

@Injectable()
export class EFormRequestService {
  constructor(
    private readonly auditService: AuditService,
    @InjectRepository(EFormRequest)
    private readonly eformRequestRepository: Repository<EFormRequest>,
    @InjectRepository(EFormApproval)
    private readonly eformApprovalRepository: Repository<EFormApproval>,
    @InjectRepository(EFormSignature)
    private readonly eformSignatureRepository: Repository<EFormSignature>,
    @InjectRepository(EFormCredential)
    private readonly eformCredentialRepository: Repository<EFormCredential>,
    private readonly credentialService: EFormCredentialService,
    private readonly pdfService: EFormPdfService,
    private readonly settingsService: SettingsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getVpnTerms() {
    return this.settingsService.getSetting<string>('eform.vpn.terms', `
      <p><strong>1. KEBIJAKAN PENGGUNAAN</strong><br/>Layanan VPN hanya digunakan untuk kepentingan pekerjaan PT. Santos Jaya Abadi.</p>
      <p><strong>2. KERAHASIAAN KREDENSIAL</strong><br/>User dilarang memberikan username dan password kepada pihak lain.</p>
      <p><strong>3. KEAMANAN PERANGKAT</strong><br/>Pastikan perangkat yang digunakan bebas dari malware/virus.</p>
    `);
  }

  async setVpnTerms(terms: string, userId: string) {
    return this.settingsService.setSetting('eform.vpn.terms', terms, userId, 'VPN E-Form Terms & Conditions');
  }

  async createRequest(userId: string, userFullName: string, dto: CreateEFormRequestDto) {
    const requesterName = dto.requesterName?.trim() || userFullName;
    const request = this.eformRequestRepository.create({
      formType: dto.formType,
      status: EFormStatus.PENDING_MANAGER,
      requesterId: userId,
      requesterName,
      requesterDepartment: dto.requesterDepartment || null,
      formData: dto.formData,
      requestedWebsites: dto.requestedWebsites,
      networkPurpose: dto.networkPurpose,
      termsAccepted: dto.termsAccepted,
      currentApproverId: dto.managerId,
      submittedAt: new Date(),
    });

    const savedRequest = await this.eformRequestRepository.save(request);

    await this.eformSignatureRepository.save({
      eformRequestId: savedRequest.id,
      signerId: userId,
      signerName: requesterName,
      signatureData: dto.signatureData,
      signerRole: 'REQUESTER',
    });

    await this.eformApprovalRepository.save({
      eformRequestId: savedRequest.id,
      approverId: dto.managerId,
      role: 'MANAGER',
      action: 'PENDING',
      sequence: 2,
    });

    this.eventEmitter.emit('eform.submitted', { request: savedRequest, managerId: dto.managerId });

    return savedRequest;
  }

  async approveByManager(requestId: string, managerId: string, managerName: string, dto: ApproveManagerDto) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== EFormStatus.PENDING_MANAGER) throw new BadRequestException('Invalid state');
    if (request.currentApproverId !== managerId) throw new ForbiddenException('Not your approval');

    if (dto.action === 'REJECT') {
      request.status = EFormStatus.REJECTED;
      request.rejectionReason = dto.rejectionReason;
      const saved = await this.eformRequestRepository.save(request);
      await this.eformApprovalRepository.update(
        { eformRequestId: requestId, approverId: managerId, role: 'MANAGER' },
        { action: 'REJECTED', actionAt: new Date(), notes: dto.rejectionReason },
      );
      this.eventEmitter.emit('eform.rejected', { request: saved });
      return saved;
    }

    await this.eformSignatureRepository.save({
      eformRequestId: requestId,
      signerId: managerId,
      signerName: managerName,
      signatureData: dto.signatureData,
      signerRole: 'MANAGER',
    });

    await this.eformApprovalRepository.update(
      { eformRequestId: requestId, approverId: managerId, role: 'MANAGER' },
      { action: 'APPROVED', actionAt: new Date() },
    );

    request.status = EFormStatus.PENDING_ICT;
    request.currentApproverId = null;
    const savedRequest = await this.eformRequestRepository.save(request);

    this.eventEmitter.emit('eform.manager-approved', { request: savedRequest });

    return savedRequest;
  }

  async submitCredentials(requestId: string, agentId: string, dto: SubmitCredentialDto) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== EFormStatus.PENDING_ICT) throw new BadRequestException('Invalid state');

    const encrypted = this.credentialService.encrypt(`${dto.username}:${dto.password}`);

    await this.eformCredentialRepository.save({
      eformRequestId: requestId,
      encryptedUsername: encrypted.ciphertext,
      encryptedPassword: encrypted.authTag,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      vpnServer: dto.vpnServer || null,
      notes: dto.notes || null,
      provisionedById: agentId,
      accessCreatedAt: new Date(),
    });

    request.status = EFormStatus.CONFIRMED;
    request.resolvedAt = new Date();
    const savedRequest = await this.eformRequestRepository.save(request);

    this.eventEmitter.emit('eform.ict-confirmed', { request: savedRequest });

    return savedRequest;
  }

  async getCredentials(requestId: string, userId: string, userRole: UserRole) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    const isICT = ICT_ROLES.includes(userRole);
    const isRequester = request.requesterId === userId;
    if (!isICT && !isRequester) throw new ForbiddenException('Access denied');

    const credential = await this.eformCredentialRepository.findOne({ where: { eformRequestId: requestId } });
    if (!credential) throw new NotFoundException('Credentials not ready');

    const decrypted = this.credentialService.decrypt(credential.encryptedUsername, credential.iv, credential.authTag);
    const [username, password] = decrypted.split(':');

    return {
      username,
      password,
      vpnServer: credential.vpnServer,
      notes: credential.notes,
      provisionedAt: credential.provisionedAt,
    };
  }

  async getMyRequests(userId: string) {
    return this.eformRequestRepository.find({
      where: { requesterId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingApprovals(userId: string) {
    return this.eformRequestRepository.find({
      where: { currentApproverId: userId, status: EFormStatus.PENDING_MANAGER },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.eformRequestRepository.find({ order: { createdAt: 'DESC' } });
  }

  async getDetails(id: string) {
    const request = await this.eformRequestRepository.findOne({
      where: { id },
      relations: ['signatures', 'approvals'],
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async rejectRequest(requestId: string, userId: string, reason: string) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    request.status = EFormStatus.REJECTED;
    request.rejectionReason = reason;
    const savedRequest = await this.eformRequestRepository.save(request);

    this.eventEmitter.emit('eform.rejected', { request: savedRequest, userId });

    this.auditService.logAsync({
      userId,
      action: AuditAction.EFORM_REJECT,
      entityType: 'EFormRequest',
      entityId: requestId,
      description: 'Rejected E-Form Request',
      newValue: { reason },
    });

    return savedRequest;
  }

  async generatePdf(id: string) {
    const request = await this.eformRequestRepository.findOne({
      where: { id },
      relations: ['signatures'],
    });
    if (!request) throw new NotFoundException('Request not found');
    return this.pdfService.generatePdf(request);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/eform-request/eform-request.service.ts
git commit -m "feat(eform): refactor service to single-manager approval flow"
```

---

## Task 5: Backend — Update Controller

**Files:**
- Modify: `apps/backend/src/modules/eform-request/eform-request.controller.ts`

- [ ] **Step 1: Replace full controller file**

```typescript
// apps/backend/src/modules/eform-request/eform-request.controller.ts
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
    return this.eformRequestService.createRequest(req.user.userId, req.user.fullName, dto);
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
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Patch(':id/manager-approve')
  @ApiOperation({ summary: 'Manager approves or rejects request' })
  async approveByManager(@Request() req: any, @Param('id') id: string, @Body() dto: ApproveManagerDto) {
    return this.eformRequestService.approveByManager(id, req.user.userId, req.user.fullName, dto);
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/eform-request/eform-request.controller.ts
git commit -m "feat(eform): update controller — single manager endpoint + credential endpoints"
```

---

## Task 6: Backend — Update Notification Listener

**Files:**
- Modify: `apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts`

- [ ] **Step 1: Replace listener file**

```typescript
// apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { EFormRequest } from '../entities/eform-request.entity';

@Injectable()
export class EFormNotificationListener {
  private readonly logger = new Logger(EFormNotificationListener.name);

  constructor(private readonly notificationCenter: NotificationCenterService) {}

  @OnEvent('eform.submitted')
  async handleEFormSubmitted(payload: { request: EFormRequest; managerId: string }) {
    try {
      await this.notificationCenter.send({
        userId: payload.managerId,
        type: NotificationType.EFORM_SUBMITTED,
        title: 'Permintaan Akses Baru',
        message: `${payload.request.requesterName} mengajukan permintaan akses ${payload.request.formType} dan menunggu persetujuan Anda.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to notify manager for eform.submitted: ${error.message}`);
    }
  }

  @OnEvent('eform.manager-approved')
  async handleEFormManagerApproved(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.sendToRole('ADMIN', {
        type: NotificationType.EFORM_MANAGER2_APPROVED,
        title: 'Provisioning Akses Diperlukan',
        message: `Permintaan ${payload.request.formType} dari ${payload.request.requesterName} telah disetujui dan siap diproses.`,
        referenceId: payload.request.id,
      });
      await this.notificationCenter.sendToRole('AGENT_ADMIN', {
        type: NotificationType.EFORM_MANAGER2_APPROVED,
        title: 'Provisioning Akses Diperlukan',
        message: `Permintaan ${payload.request.formType} dari ${payload.request.requesterName} telah disetujui dan siap diproses.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to notify ICT for eform.manager-approved: ${error.message}`);
    }
  }

  @OnEvent('eform.ict-confirmed')
  async handleEFormIctConfirmed(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({
        userId: payload.request.requesterId,
        type: NotificationType.EFORM_CREDENTIALS_READY,
        title: `Akses ${payload.request.formType} Aktif`,
        message: `Akses ${payload.request.formType} Anda telah aktif. Buka halaman detail untuk melihat kredensial.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to notify requester for eform.ict-confirmed: ${error.message}`);
    }
  }

  @OnEvent('eform.rejected')
  async handleEFormRejected(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({
        userId: payload.request.requesterId,
        type: NotificationType.EFORM_REJECTED,
        title: 'Permintaan Akses Ditolak',
        message: `Permintaan akses ${payload.request.formType} Anda ditolak. Alasan: ${payload.request.rejectionReason}`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to notify requester for eform.rejected: ${error.message}`);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/eform-request/listeners/eform-notification.listener.ts
git commit -m "feat(eform): update notification — single manager event, notify ADMIN+AGENT_ADMIN for ICT"
```

---

## Task 7: Frontend — Update API Layer

**Files:**
- Modify: `apps/frontend/src/features/request-center/api/eform-request.api.ts`

- [ ] **Step 1: Replace api file**

```typescript
// apps/frontend/src/features/request-center/api/eform-request.api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const API_BASE = '/eform-request';

export interface EFormSignature {
  id: string;
  signerName: string;
  signatureData: string;
  signerRole: string;
  signedAt: string;
}

export interface EFormRequest {
  id: string;
  formType: string;
  status: string;
  requesterId: string;
  requesterName: string;
  requesterDepartment?: string;
  formData: any;
  requestedWebsites?: string;
  networkPurpose?: string;
  termsAccepted: boolean;
  rejectionReason?: string;
  currentApproverId?: string;
  submittedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  signatures?: EFormSignature[];
  approvals?: any[];
}

export interface EFormCredentials {
  username: string;
  password: string;
  vpnServer?: string;
  notes?: string;
  provisionedAt?: string;
}

export const useEformRequests = (all = false) => {
  return useQuery<EFormRequest[]>({
    queryKey: ['eform-requests', all],
    queryFn: async () => {
      const endpoint = all ? `${API_BASE}/all` : `${API_BASE}/my`;
      const { data } = await api.get(endpoint);
      return Array.isArray(data) ? data : [];
    },
  });
};

export const usePendingApprovals = () => {
  return useQuery<EFormRequest[]>({
    queryKey: ['eform-pending-approvals'],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/pending-approvals`);
      return Array.isArray(data) ? data : [];
    },
  });
};

export const useVpnTerms = () => {
  return useQuery<{ terms: string }>({
    queryKey: ['eform-vpn-terms'],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/terms`);
      return data;
    },
  });
};

export const useUpdateVpnTerms = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (terms: string) => {
      const { data } = await api.patch(`${API_BASE}/terms`, { terms });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eform-vpn-terms'] });
    },
  });
};

export const useEformDetail = (id: string) => {
  return useQuery<EFormRequest>({
    queryKey: ['eform-request', id],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateEformRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      formType: string;
      requesterName?: string;
      requesterDepartment?: string;
      formData: any;
      requestedWebsites?: string;
      networkPurpose?: string;
      termsAccepted: boolean;
      signatureData: string;
      managerId: string;
    }) => {
      const { data } = await api.post(API_BASE, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useApproveByManager = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      signatureData?: string;
      rejectionReason?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.patch(`${API_BASE}/${id}/manager-approve`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
      queryClient.invalidateQueries({ queryKey: ['eform-pending-approvals'] });
    },
  });
};

export const useSubmitCredentials = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      username: string;
      password: string;
      vpnServer?: string;
      notes?: string;
    }) => {
      const { id, ...body } = payload;
      const { data } = await api.post(`${API_BASE}/${id}/credentials`, body);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-credentials', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useGetCredentials = (id: string, enabled = false) => {
  return useQuery<EFormCredentials>({
    queryKey: ['eform-credentials', id],
    queryFn: async () => {
      const { data } = await api.get(`${API_BASE}/${id}/credentials`);
      return data;
    },
    enabled: enabled && !!id,
  });
};

export const useRejectRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await api.patch(`${API_BASE}/${id}/reject`, { reason });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['eform-request', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['eform-requests'] });
    },
  });
};

export const useGetEformPdf = (id: string) => {
  return async () => {
    const response = await api.get(`${API_BASE}/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EForm-VPN-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/api/eform-request.api.ts
git commit -m "feat(eform): update frontend API — single manager hook, credential hooks"
```

---

## Task 8: Frontend — Update ManagerSelector

**Files:**
- Modify: `apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx`

- [ ] **Step 1: Change fetch endpoint to all users**

Find this line in ManagerSelector.tsx:
```typescript
const { data } = await api.get('/users/approvers');
```

Replace with:
```typescript
const { data: response } = await api.get('/users?limit=200');
// Backend paginates — extract items array
return Array.isArray(response) ? response : (response?.data ?? response?.items ?? []);
```

- [ ] **Step 2: Update the full query block**

```typescript
const { data: managers = [], isLoading } = useQuery<Manager[]>({
  queryKey: ['users', 'all-for-selector'],
  queryFn: async () => {
    const { data: response } = await api.get('/users?limit=200');
    const list = Array.isArray(response) ? response : (response?.data ?? response?.items ?? []);
    return list;
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/request-center/components/eform/ManagerSelector.tsx
git commit -m "feat(eform): manager selector fetch from all users"
```

---

## Task 9: Frontend — Update SignaturePad (nama terang + tanggal)

**Files:**
- Modify: `apps/frontend/src/features/request-center/components/eform/SignaturePad.tsx`

- [ ] **Step 1: Read current SignaturePad.tsx first**

Run: `Read apps/frontend/src/features/request-center/components/eform/SignaturePad.tsx`

- [ ] **Step 2: After the signature canvas + lock confirmation, add nama terang + tanggal block**

Find the section that renders after `onSave` is called (when `signatureData` is set / signature is locked). Add below the lock confirmation:

```tsx
{signatureData && (
  <div className="grid grid-cols-2 gap-3 mt-3">
    <div className="space-y-1">
      <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
        Nama Terang
      </label>
      <div className="h-10 rounded-xl bg-muted border border-border/30 px-3 flex items-center font-bold text-sm text-muted-foreground">
        {signerName}
      </div>
    </div>
    <div className="space-y-1">
      <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
        Tanggal TTD
      </label>
      <div className="h-10 rounded-xl bg-muted border border-border/30 px-3 flex items-center font-bold text-sm text-muted-foreground">
        {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/request-center/components/eform/SignaturePad.tsx
git commit -m "feat(eform): show nama terang and tanggal TTD after signature locked"
```

---

## Task 10: Frontend — Rework EformAccessCreatePage

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx`

- [ ] **Step 1: Replace full file**

```tsx
// apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Send, CheckCircle2, Calendar, Globe, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignaturePad } from '../components/eform/SignaturePad';
import { ManagerSelector } from '../components/eform/ManagerSelector';
import { TermsAndConditions } from '../components/eform/TermsAndConditions';
import { useCreateEformRequest, useVpnTerms } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

type FormType = 'VPN' | 'WEBSITE' | 'NETWORK';

const FORM_TYPES = [
  { id: 'VPN' as FormType, label: 'VPN Access', icon: ShieldCheck },
  { id: 'WEBSITE' as FormType, label: 'Website Access', icon: Globe },
  { id: 'NETWORK' as FormType, label: 'Network Access', icon: Wifi },
];

export const EformAccessCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formType, setFormType] = useState<FormType>('VPN');
  const [requesterName, setRequesterName] = useState(user?.fullName || '');
  const [requesterDepartment, setRequesterDepartment] = useState(user?.department?.name || user?.departmentId || '');
  const [formData, setFormData] = useState({
    kebutuhanAkses: 'Remote PC Kantor',
    alasan: '',
    dariTanggal: new Date().toISOString().split('T')[0],
    sampaiTanggal: '',
  });
  const [requestedWebsites, setRequestedWebsites] = useState('');
  const [networkPurpose, setNetworkPurpose] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [managerId, setManagerId] = useState('');

  const createMutation = useCreateEformRequest();
  const { data: termsData } = useVpnTerms();

  const isValid =
    !!requesterName &&
    !!formData.alasan &&
    !!formData.dariTanggal &&
    termsAccepted &&
    !!signatureData &&
    !!managerId &&
    (formType !== 'WEBSITE' || !!requestedWebsites) &&
    (formType !== 'NETWORK' || !!networkPurpose);

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error('Lengkapi semua field yang wajib diisi');
      return;
    }
    try {
      await createMutation.mutateAsync({
        formType,
        requesterName,
        requesterDepartment,
        formData,
        requestedWebsites: formType === 'WEBSITE' ? requestedWebsites : undefined,
        networkPurpose: formType === 'NETWORK' ? networkPurpose : undefined,
        termsAccepted,
        signatureData,
        managerId,
      });
      toast.success('Permintaan berhasil dikirim');
      navigate(-1);
    } catch {
      toast.error('Gagal mengirim permintaan');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
      </div>

      {/* Main compact card */}
      <div className="rounded-[2rem] overflow-hidden border border-primary/10 shadow-xl">
        {/* Gradient header */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-indigo-600 px-8 py-6">
          <h1 className="text-xl font-black tracking-tighter uppercase text-white">E-Form Access Request</h1>
          <p className="text-[11px] text-white/60 mt-1 font-medium tracking-wide">Form Permintaan Akses Digital</p>
        </div>

        {/* Form type tabs */}
        <div className="px-8 pt-5 pb-2 bg-background border-b border-border/30">
          <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 mb-3 block">Jenis Akses</label>
          <div className="flex gap-2">
            {FORM_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFormType(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-150 ${
                  formType === id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/40 text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="px-8 py-6 bg-background space-y-5">
          {/* Nama + Dept */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Nama Pemohon *</label>
              <Input
                value={requesterName}
                onChange={e => setRequesterName(e.target.value)}
                placeholder="Nama lengkap"
                className="h-11 rounded-xl border-border/50 font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Departemen</label>
              <Input
                value={requesterDepartment}
                onChange={e => setRequesterDepartment(e.target.value)}
                placeholder="Nama departemen"
                className="h-11 rounded-xl border-border/50 font-bold"
              />
            </div>
          </div>

          {/* Tanggal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Dari Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                <Input
                  type="date"
                  value={formData.dariTanggal}
                  onChange={e => setFormData({ ...formData, dariTanggal: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Sampai Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40" />
                <Input
                  type="date"
                  value={formData.sampaiTanggal}
                  onChange={e => setFormData({ ...formData, sampaiTanggal: e.target.value })}
                  className="pl-10 h-11 rounded-xl border-border/50 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Type-specific field */}
          {formType === 'VPN' && (
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Kebutuhan Akses VPN</label>
              <Input
                value={formData.kebutuhanAkses}
                onChange={e => setFormData({ ...formData, kebutuhanAkses: e.target.value })}
                className="h-11 rounded-xl border-border/50 font-bold"
              />
            </div>
          )}
          {formType === 'WEBSITE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Website yang Diminta (URL) *</label>
              <Input
                value={requestedWebsites}
                onChange={e => setRequestedWebsites(e.target.value)}
                placeholder="github.com, stackoverflow.com"
                className="h-11 rounded-xl border-border/50 font-bold"
              />
            </div>
          )}
          {formType === 'NETWORK' && (
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tujuan Akses Jaringan *</label>
              <Input
                value={networkPurpose}
                onChange={e => setNetworkPurpose(e.target.value)}
                placeholder="Akses server client XYZ"
                className="h-11 rounded-xl border-border/50 font-bold"
              />
            </div>
          )}

          {/* Alasan */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Alasan Pengajuan *</label>
            <textarea
              value={formData.alasan}
              onChange={e => setFormData({ ...formData, alasan: e.target.value })}
              placeholder="Tuliskan alasan lengkap mengapa akses ini dibutuhkan..."
              className="w-full min-h-[90px] p-4 rounded-2xl border-2 border-border/50 bg-background text-sm font-medium focus:border-primary/30 outline-none transition-colors resize-none"
            />
          </div>

          <div className="border-t border-dashed border-border/40 pt-5 space-y-5">
            {/* Atasan */}
            <ManagerSelector selectedId={managerId} onSelect={setManagerId} />

            {/* T&C inline */}
            <TermsAndConditions
              accepted={termsAccepted}
              onAccept={setTermsAccepted}
              content={termsData?.terms || 'Loading...'}
            />

            {/* Tanda Tangan */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan Pemohon</label>
              <SignaturePad signerName={requesterName} onSave={setSignatureData} />
              {signatureData && (
                <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 dark:bg-green-950/30 p-2 rounded-lg border border-green-100 dark:border-green-900/30">
                  <CheckCircle2 size={13} /> Tanda tangan berhasil dikunci
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!isValid || createMutation.isPending}
              className="w-full rounded-2xl h-13 bg-primary shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-[10px]"
            >
              {createMutation.isPending ? 'Mengirim...' : 'Kirim Pengajuan'} <Send className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/EformAccessCreatePage.tsx
git commit -m "feat(eform): rework create page — modern compact layout, editable name/dept, inline T&C"
```

---

## Task 11: Frontend — Create EformApprovalPage

**Files:**
- Create: `apps/frontend/src/features/request-center/pages/EformApprovalPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/features/request-center/pages/EformApprovalPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '../components/eform/SignaturePad';
import { useEformDetail, useApproveByManager } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

export const EformApprovalPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eform, isLoading } = useEformDetail(id!);
  const approveMutation = useApproveByManager();

  const [signatureData, setSignatureData] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isMyApproval = eform?.currentApproverId === user?.id;
  const isPendingManager = eform?.status === 'PENDING_MANAGER';
  const canAct = isMyApproval && isPendingManager;

  const requesterSig = eform?.signatures?.find(s => s.signerRole === 'REQUESTER');

  const handleApprove = async () => {
    if (!signatureData) {
      toast.error('Harap tanda tangani terlebih dahulu');
      return;
    }
    try {
      await approveMutation.mutateAsync({ id: id!, action: 'APPROVE', signatureData });
      toast.success('Permintaan disetujui');
      navigate(-1);
    } catch {
      toast.error('Gagal menyetujui permintaan');
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Harap isi alasan penolakan');
      return;
    }
    try {
      await approveMutation.mutateAsync({ id: id!, action: 'REJECT', rejectionReason });
      toast.success('Permintaan ditolak');
      navigate(-1);
    } catch {
      toast.error('Gagal menolak permintaan');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
  if (!eform) return <div className="p-8 text-center text-muted-foreground">Permintaan tidak ditemukan</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
        <Badge variant={isPendingManager ? 'outline' : 'secondary'}>
          {isPendingManager ? <><Clock size={11} className="mr-1" /> Menunggu Persetujuan</> : eform.status}
        </Badge>
      </div>

      <div className="rounded-[2rem] overflow-hidden border border-primary/10 shadow-xl">
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-8 py-6">
          <h1 className="text-xl font-black tracking-tighter uppercase text-white">Review Permintaan Akses</h1>
          <p className="text-[11px] text-white/70 mt-1">#{eform.id.slice(0, 8).toUpperCase()} — {eform.formType}</p>
        </div>

        <div className="px-8 py-6 bg-background space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nama Pemohon', value: eform.requesterName },
              { label: 'Departemen', value: eform.requesterDepartment || '-' },
              { label: 'Jenis Akses', value: eform.formType },
              { label: 'Dari Tanggal', value: eform.formData?.dariTanggal || '-' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-xl p-3">
                <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1">{label}</div>
                <div className="text-sm font-bold">{value}</div>
              </div>
            ))}
          </div>

          {eform.formData?.alasan && (
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-2">Alasan Pengajuan</div>
              <p className="text-sm font-medium leading-relaxed">{eform.formData.alasan}</p>
            </div>
          )}

          {/* Requester signature (read-only) */}
          {requesterSig && (
            <div className="space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Tanda Tangan Pemohon</div>
              <div className="border-2 border-border/30 rounded-2xl p-4 bg-muted/20 space-y-3">
                <img src={requesterSig.signatureData} alt="TTD Pemohon" className="max-h-24 object-contain" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Nama Terang</div>
                    <div className="text-sm font-bold mt-1">{requesterSig.signerName}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Tanggal TTD</div>
                    <div className="text-sm font-bold mt-1">
                      {new Date(requesterSig.signedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manager action area */}
          {canAct && (
            <div className="border-t border-dashed border-border/40 pt-5 space-y-5">
              {!showRejectInput ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
                      Tanda Tangan Anda (Atasan)
                    </label>
                    <SignaturePad signerName={user?.fullName || ''} onSave={setSignatureData} />
                    {signatureData && (
                      <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 dark:bg-green-950/30 p-2 rounded-lg border border-green-100">
                        <CheckCircle2 size={13} /> Tanda tangan dikunci
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={!signatureData || approveMutation.isPending}
                      className="rounded-2xl h-12 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-[10px] text-white shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="mr-2 w-4 h-4" /> Setujui
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectInput(true)}
                      className="rounded-2xl h-12 border-destructive/40 text-destructive font-black uppercase tracking-widest text-[10px] hover:bg-destructive/5"
                    >
                      <XCircle className="mr-2 w-4 h-4" /> Tolak
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60 text-destructive">
                      Alasan Penolakan *
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder="Tuliskan alasan penolakan..."
                      className="w-full min-h-[80px] p-4 rounded-2xl border-2 border-destructive/30 bg-background text-sm font-medium outline-none resize-none focus:border-destructive/60 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleReject}
                      disabled={!rejectionReason.trim() || approveMutation.isPending}
                      className="rounded-2xl h-12 bg-destructive font-black uppercase tracking-widest text-[10px] text-white"
                    >
                      <XCircle className="mr-2 w-4 h-4" /> Konfirmasi Tolak
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowRejectInput(false)}
                      className="rounded-2xl h-12 font-black uppercase tracking-widest text-[10px]"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!canAct && eform.status === 'PENDING_MANAGER' && !isMyApproval && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 text-center">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Permintaan ini menunggu persetujuan atasan lain.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/EformApprovalPage.tsx
git commit -m "feat(eform): add EformApprovalPage — manager review, sign, approve/reject"
```

---

## Task 12: Frontend — Create EformCredentialPage

**Files:**
- Create: `apps/frontend/src/features/request-center/pages/EformCredentialPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/frontend/src/features/request-center/pages/EformCredentialPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Copy, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEformDetail, useGetCredentials, useSubmitCredentials } from '../api/eform-request.api';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';

const ICT_ROLES = ['ADMIN', 'AGENT_ADMIN'];

export const EformCredentialPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: eform, isLoading } = useEformDetail(id!);

  const isICT = ICT_ROLES.includes(user?.role || '');
  const isRequester = eform?.requesterId === user?.id;
  const canView = isICT || isRequester;

  const { data: credentials, refetch: fetchCredentials, isFetching } = useGetCredentials(id!, eform?.status === 'CONFIRMED' && isRequester);
  const submitMutation = useSubmitCredentials();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vpnServer, setVpnServer] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credsFetched, setCredsFetched] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      toast.error('Username dan password wajib diisi');
      return;
    }
    try {
      await submitMutation.mutateAsync({ id: id!, username, password, vpnServer, notes });
      toast.success('Kredensial berhasil disimpan dan dikirimkan ke user');
      navigate(-1);
    } catch {
      toast.error('Gagal menyimpan kredensial');
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin`);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
  if (!eform) return <div className="p-8 text-center text-muted-foreground">Permintaan tidak ditemukan</div>;

  if (!canView) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <Lock size={48} className="mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-black uppercase tracking-tighter">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground">Halaman ini hanya dapat diakses oleh tim ICT dan pemohon.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
          <ArrowLeft className="mr-2 w-4 h-4" /> Kembali
        </Button>
      </div>

      <div className="rounded-[2rem] overflow-hidden border border-primary/10 shadow-xl">
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8 py-6">
          <h1 className="text-xl font-black tracking-tighter uppercase text-white">
            {isICT && eform.status === 'PENDING_ICT' ? 'Buat Akses' : 'Kredensial Akses'}
          </h1>
          <p className="text-[11px] text-white/60 mt-1">{eform.requesterName} — {eform.formType}</p>
        </div>

        <div className="px-8 py-6 bg-background space-y-5">
          {/* ICT input form */}
          {isICT && eform.status === 'PENDING_ICT' && (
            <>
              <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-2xl p-4">
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Pemohon</div>
                  <div className="text-sm font-bold mt-1">{eform.requesterName}</div>
                </div>
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest opacity-50">Jenis</div>
                  <div className="text-sm font-bold mt-1">{eform.formType}</div>
                </div>
              </div>

              <div className="border-t border-dashed border-border/40 pt-4 space-y-4">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-violet-500">
                  Input Kredensial
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Username *</label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="nama.user@company.vpn" className="h-11 rounded-xl font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Password Awal *</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password awal untuk user"
                      className="h-11 rounded-xl font-mono pr-12"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">VPN Server / Host</label>
                  <Input value={vpnServer} onChange={e => setVpnServer(e.target.value)} placeholder="vpn.company.com:1194" className="h-11 rounded-xl font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Catatan ICT (Opsional)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Instruksi tambahan untuk user..."
                    className="w-full min-h-[70px] p-4 rounded-2xl border-2 border-border/50 bg-background text-sm font-medium outline-none resize-none focus:border-primary/30 transition-colors"
                  />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!username || !password || submitMutation.isPending}
                  className="w-full rounded-2xl h-12 bg-violet-600 hover:bg-violet-700 font-black uppercase tracking-widest text-[10px] text-white shadow-lg shadow-violet-500/20"
                >
                  <CheckCircle2 className="mr-2 w-4 h-4" />
                  {submitMutation.isPending ? 'Menyimpan...' : 'Selesai — Kirim Kredensial ke User'}
                </Button>
              </div>
            </>
          )}

          {/* User/ICT view after CONFIRMED */}
          {eform.status === 'CONFIRMED' && (
            <div className="space-y-4">
              {!credentials && !credsFetched ? (
                <Button
                  onClick={async () => { await fetchCredentials(); setCredsFetched(true); }}
                  disabled={isFetching}
                  variant="outline"
                  className="w-full rounded-2xl h-11 font-black uppercase tracking-widest text-[10px]"
                >
                  <Eye className="mr-2 w-4 h-4" /> {isFetching ? 'Memuat...' : 'Tampilkan Kredensial'}
                </Button>
              ) : credentials ? (
                <div className="bg-slate-950 border border-blue-500/20 rounded-2xl p-5 space-y-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                    <Lock size={11} /> Kredensial Akses {eform.formType}
                  </div>
                  {[
                    { label: 'Username', value: credentials.username },
                    { label: 'Password Awal', value: credentials.password, mono: true, sensitive: true },
                    ...(credentials.vpnServer ? [{ label: 'VPN Server', value: credentials.vpnServer, mono: true }] : []),
                  ].map(({ label, value, mono, sensitive }) => (
                    <div key={label} className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3">
                      <div>
                        <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{label}</div>
                        <div className={`text-sm font-bold text-blue-300 mt-0.5 ${mono ? 'font-mono' : ''}`}>
                          {sensitive && !showPassword ? '••••••••••' : value}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {sensitive && (
                          <button onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-slate-300">
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button onClick={() => handleCopy(value, label)} className="text-slate-500 hover:text-slate-300">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {credentials.notes && (
                    <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl px-4 py-3">
                      <div className="text-[9px] font-extrabold uppercase tracking-widest text-amber-500 mb-1">Catatan ICT</div>
                      <p className="text-xs text-amber-300/80">{credentials.notes}</p>
                    </div>
                  )}
                  <div className="bg-amber-950/20 rounded-xl px-4 py-2 text-[10px] text-amber-400 font-bold">
                    ⚠ Segera ganti password setelah login pertama
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {eform.status !== 'PENDING_ICT' && eform.status !== 'CONFIRMED' && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Kredensial belum tersedia. Status: {eform.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/EformCredentialPage.tsx
git commit -m "feat(eform): add EformCredentialPage — ICT input + requester read-only view"
```

---

## Task 13: Frontend — Add Routes

**Files:**
- Modify: `apps/frontend/src/routes/AppRoutes.tsx`

- [ ] **Step 1: Add lazy imports (after existing eform imports, ~line 72)**

```typescript
const EformApprovalPage = lazy(() => import('../features/request-center/pages/EformApprovalPage').then(m => ({ default: m.EformApprovalPage })));
const EformCredentialPage = lazy(() => import('../features/request-center/pages/EformCredentialPage').then(m => ({ default: m.EformCredentialPage })));
```

- [ ] **Step 2: Add routes in all 3 layout groups (after each `eform-access/:id` route)**

Find each of the 3 occurrences of:
```tsx
<Route path="eform-access/:id" element={<LazyRoute component={EformAccessDetailPage} featureName="E-Form Access Detail" requiredPageAccess="eform_access" />} />
```

After each one, add:
```tsx
<Route path="eform-access/:id/approve" element={<LazyRoute component={EformApprovalPage} featureName="E-Form Approval" requiredPageAccess="eform_access" />} />
<Route path="eform-access/:id/credentials" element={<LazyRoute component={EformCredentialPage} featureName="E-Form Credentials" requiredPageAccess="eform_access" />} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/routes/AppRoutes.tsx
git commit -m "feat(eform): add routes for approval and credential pages"
```

---

## Self-Review Checklist

- [x] Status enum updated: PENDING_MANAGER_1 → PENDING_MANAGER, PENDING_MANAGER_2 removed ✓
- [x] EFormCredential entity: vpnServer + notes added ✓
- [x] EFormSignature: signerName + signedAt already exist — no migration needed ✓
- [x] DTO: requesterName/requesterDepartment optional in CreateEFormRequestDto ✓
- [x] Service: approveByManager handles both APPROVE and REJECT in one method ✓
- [x] Service: getCredentials allows ICT roles + requester ✓
- [x] Controller: manager1-approve renamed to manager-approve, manager2-approve removed ✓
- [x] Notification: eform.manager-approved sends to ADMIN + AGENT_ADMIN ✓
- [x] Frontend API: useApproveByManager replaces useApproveManager1 (no nextApproverId) ✓
- [x] ManagerSelector: fetches /users?limit=200 ✓
- [x] SignaturePad: shows nama terang + tanggal TTD after lock ✓
- [x] EformAccessCreatePage: no Section headings, Modern Compact layout, editable fields ✓
- [x] EformApprovalPage: reads requester signature, manager signs + approves/rejects ✓
- [x] EformCredentialPage: ICT input + user read-only, access guard frontend ✓
- [x] Routes: 3 layout groups each get 2 new routes ✓
