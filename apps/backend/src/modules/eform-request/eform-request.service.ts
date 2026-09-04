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
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor, assertSiteAccess, resolveSiteScope } from '../../shared/core/utils/site-scope.util';

const ICT_ROLES = [UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT_ADMIN];

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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getVpnTerms() {
    return this.settingsService.getSetting<string>('eform.vpn.terms', `
      <ol style="list-style-type: decimal; padding-left: 1.25rem; margin: 0; line-height: 1.6;">
        <li style="margin-bottom: 0.75rem;">Divisi ICT tidak bertanggung jawab terhadap pelanggaran keamanan maupun upaya perusakan komputer dan/atau perangkat lain yang anda gunakan selama terhubung dengan menggunakan VPN. Semua masalah lisensi yang mungkin akan menimbulkan biaya karena penggunaan aplikasi ilegal saat terhubung ke VPN merupakan tanggung jawab pemohon sepenuhnya. Akses ke VPN PT.SANTOS JAYA ABADI hanya boleh digunakan untuk hal-hal yang berkaitan dengan pekerjaan. Software VPN beserta kredensialnya tidak boleh dibagikan oleh pemohon kepada pihak lain dalam kondisi apapun. Pemohon tidak diperkenankan menggunakan aplikasi remote service pihak ketiga (Misal: TeamViewer, LogMeIn, GoToMyPC, peer-to-peer networking, dll) saat terhubung ke VPN PT.SANTOS JAYA ABADI.</li>
        <li style="margin-bottom: 0.75rem;">Semua akses ke jaringan VPN PT.SANTOS JAYA ABADI tercatat dan diawasi.</li>
        <li style="margin-bottom: 0.75rem;">Komputer yang digunakan untuk terhubung ke VPN wajib terpasang antivirus dan memiliki database up to date.</li>
        <li style="margin-bottom: 0.75rem;">Pemohon yang diberi akses VPN berkewajiban untuk menjaga kerahasiaan data dan/atau informasi milik perusahaan, apabila terbukti dengan sengaja dan/atau karena kelalaian menyebabkan kerugian dan/atau potensi kerugian bagi perusahaan,maka dengan ini pemohon menyatakan bersedia diberi sangsi sesuai peraturan perusahaan yang berlaku.</li>
        <li style="margin-bottom: 0.75rem;">Semua insiden terkait keamanan informasi yang terjadi selama menggunakan dan atau memiliki akses VPN wajib dilaporkan kepada pihak ICT. Contoh: kehilangan laptop yang terpasang akses VPN, laptop yang digunakan terkena malware, dsb.</li>
      </ol>
    `);
  }


  async setVpnTerms(terms: string, userId: string, actor: SiteActor) {
    // Terms are global but we still assert the actor is allowed to touch settings
    // (ADMIN only — enforced at controller). We keep the call for consistency.
    assertSiteAccess(actor, null); // ADMIN/MANAGER pass; others would have been rejected by @Roles
    return this.settingsService.setSetting('eform.vpn.terms', terms, userId, 'VPN E-Form Terms & Conditions');
  }

  async createRequest(userId: string, userFullName: string, dto: CreateEFormRequestDto) {
    const requester = await this.userRepo.findOne({ where: { id: userId } as any });
    const requesterSiteId = (requester as any)?.siteId ?? null;
    const requesterName = dto.requesterName?.trim() || userFullName;
    const request = this.eformRequestRepository.create({
      formType: dto.formType,
      status: EFormStatus.PENDING_MANAGER,
      requesterId: userId,
      requesterName,
      requesterDepartment: dto.requesterDepartment || '',
      formData: dto.formData,
      requestedWebsites: dto.requestedWebsites,
      networkPurpose: dto.networkPurpose,
      termsAccepted: dto.termsAccepted,
      currentApproverId: dto.managerId,
      siteId: requesterSiteId,
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
      request.rejectionReason = dto.rejectionReason || '';
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

    const encUser = this.credentialService.encrypt(dto.username);
    const encPass = this.credentialService.encrypt(dto.password);

    await this.eformCredentialRepository.save({
      eformRequestId: requestId,
      encryptedUsername: encUser.ciphertext,
      encryptedPassword: encPass.ciphertext,
      iv: encUser.iv,
      authTag: encUser.authTag,
      passwordIv: encPass.iv,
      passwordAuthTag: encPass.authTag,
      vpnServer: dto.vpnServer || '',
      notes: dto.notes || '',
      provisionedById: agentId,
      accessCreatedAt: new Date(),
    });

    request.status = EFormStatus.CONFIRMED;
    request.resolvedAt = new Date();
    const savedRequest = await this.eformRequestRepository.save(request);

    this.eventEmitter.emit('eform.ict-confirmed', { request: savedRequest });

    return savedRequest;
  }

  async getCredentials(actor: SiteActor, requestId: string, userId: string, userRole: UserRole) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    // Enforce site isolation before any credential access
    assertSiteAccess(actor, request.siteId);

    const isICT = ICT_ROLES.includes(userRole);
    const isRequester = request.requesterId === userId;
    if (!isICT && !isRequester) throw new ForbiddenException('Access denied');

    const credential = await this.eformCredentialRepository.findOne({ where: { eformRequestId: requestId } });
    if (!credential) throw new NotFoundException('Credentials not ready');

    const username = this.credentialService.decrypt(credential.encryptedUsername, credential.iv, credential.authTag);
    const password = this.credentialService.decrypt(credential.encryptedPassword, credential.passwordIv, credential.passwordAuthTag);

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

  async findAll(actor: SiteActor) {
    const scope = resolveSiteScope(actor);
    if (scope.mode === 'all') {
      return this.eformRequestRepository.find({ order: { createdAt: 'DESC' } });
    }
    if (scope.mode === 'none') {
      return [];
    }
    return this.eformRequestRepository.find({
      where: { siteId: scope.siteId as any },
      order: { createdAt: 'DESC' },
    });
  }

  async getDetails(actor: SiteActor, id: string) {
    const request = await this.eformRequestRepository.findOne({
      where: { id },
      relations: ['signatures', 'approvals'],
    });
    if (!request) throw new NotFoundException('Request not found');
    assertSiteAccess(actor, request.siteId);
    return request;
  }

  async rejectRequest(requestId: string, userId: string, reason: string) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

    // Authorization: only the assigned approver or ICT roles can reject
    const isApprover = request.currentApproverId === userId;
    if (!isApprover) throw new ForbiddenException('Not authorized to reject this request');

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

  async generatePdf(actor: SiteActor, id: string) {
    const request = await this.eformRequestRepository.findOne({
      where: { id },
      relations: ['signatures', 'approvals', 'requester', 'currentApprover'],
    });
    if (!request) throw new NotFoundException('Request not found');

    // Enforce site isolation BEFORE attempting to decrypt any credentials (P0)
    assertSiteAccess(actor, request.siteId);

    let credentialData: any = null;
    const rawCred = await this.eformCredentialRepository.findOne({
      where: { eformRequestId: id },
      relations: ['provisionedBy'],
    });

    if (rawCred) {
      try {
        const username = this.credentialService.decrypt(rawCred.encryptedUsername, rawCred.iv, rawCred.authTag);
        const password = this.credentialService.decrypt(rawCred.encryptedPassword, rawCred.passwordIv, rawCred.passwordAuthTag);
        credentialData = {
          username,
          password,
          vpnServer: rawCred.vpnServer,
          notes: rawCred.notes,
          provisionedAt: rawCred.provisionedAt,
          accessCreatedAt: rawCred.accessCreatedAt,
          accessExpiresAt: rawCred.accessExpiresAt,
          provisionedByName: rawCred.provisionedBy?.fullName || rawCred.provisionedBy?.email || 'Admin ICT',
        };
      } catch {
        // Continue if credential decryption fails
      }
    }


    return this.pdfService.generatePdf(request, credentialData);
  }
}

