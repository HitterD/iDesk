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
      requesterDepartment: dto.requesterDepartment || '',
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

  async getCredentials(requestId: string, userId: string, userRole: UserRole) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');

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

  async generatePdf(id: string) {
    const request = await this.eformRequestRepository.findOne({
      where: { id },
      relations: ['signatures'],
    });
    if (!request) throw new NotFoundException('Request not found');
    return this.pdfService.generatePdf(request);
  }
}
