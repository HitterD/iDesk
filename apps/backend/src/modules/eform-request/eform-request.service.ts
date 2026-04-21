import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EFormRequest, EFormStatus, EFormApproval, EFormSignature, EFormCredential } from './entities';
import { EFormCredentialService } from './eform-credential.service';
import { CreateEFormRequestDto, ApproveManager1Dto } from './dto';
import { EFormPdfService } from './eform-pdf.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

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

  async createRequest(userId: string, userName: string, dto: CreateEFormRequestDto) {
    const request = this.eformRequestRepository.create({
      formType: dto.formType,
      status: EFormStatus.PENDING_MANAGER_1,
      requesterId: userId,
      requesterName: userName,
      formData: dto.formData,
      termsAccepted: dto.termsAccepted,
      currentApproverId: dto.managerId,
    });

    const savedRequest = await this.eformRequestRepository.save(request);

    // Save Requester Signature
    await this.eformSignatureRepository.save({
      eformRequestId: savedRequest.id,
      signerId: userId,
      signerName: userName,
      signatureData: dto.signatureData,
      signerRole: 'REQUESTER',
    });

    // Create Approval Chain for Manager 1
    await this.eformApprovalRepository.save({
      eformRequestId: savedRequest.id,
      approverId: dto.managerId,
      role: 'MANAGER_1',
      action: 'PENDING',
      sequence: 2,
    });

    // Emit event for Manager 1
    this.eventEmitter.emit('eform.submitted', { request: savedRequest, managerId: dto.managerId });

    return savedRequest;
  }

  async approveManager1(requestId: string, managerId: string, managerName: string, dto: ApproveManager1Dto) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== EFormStatus.PENDING_MANAGER_1) throw new BadRequestException('Invalid state');
    if (request.currentApproverId !== managerId) throw new ForbiddenException('Not your approval');

    // Save Manager 1 Signature
    await this.eformSignatureRepository.save({
      eformRequestId: requestId,
      signerId: managerId,
      signerName: managerName,
      signatureData: dto.signatureData,
      signerRole: 'MANAGER_1',
    });

    // Update approval record
    await this.eformApprovalRepository.update(
      { eformRequestId: requestId, approverId: managerId, role: 'MANAGER_1' },
      { action: 'APPROVED', actionAt: new Date() }
    );

    // Next step: Manager 2
    request.status = EFormStatus.PENDING_MANAGER_2;
    request.currentApproverId = dto.nextApproverId || null;
    const savedRequest = await this.eformRequestRepository.save(request);

    await this.eformApprovalRepository.save({
      eformRequestId: requestId,
      approverId: dto.nextApproverId,
      role: 'MANAGER_2',
      action: 'PENDING',
      sequence: 3,
    });

    // Emit event for Manager 2
    this.eventEmitter.emit('eform.manager1-approved', { request: savedRequest, managerId: dto.nextApproverId });

    return savedRequest;
  }

  async getMyRequests(userId: string) {
    return this.eformRequestRepository.find({
      where: { requesterId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingApprovals(userId: string) {
    return this.eformRequestRepository.find({
      where: { currentApproverId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.eformRequestRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getDetails(id: string) {
    const request = await this.eformRequestRepository.findOne({
      where: { id },
      relations: ['signatures', 'approvals'],
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async approveManager2(requestId: string, managerId: string, managerName: string, signatureData: string) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== EFormStatus.PENDING_MANAGER_2) throw new BadRequestException('Invalid state');
    if (request.currentApproverId !== managerId) throw new ForbiddenException('Not your approval');

    // Save Manager 2 (GM) Signature
    await this.eformSignatureRepository.save({
      eformRequestId: requestId,
      signerId: managerId,
      signerName: managerName,
      signatureData: signatureData,
      signerRole: 'MANAGER_2',
    });

    // Update approval record
    await this.eformApprovalRepository.update(
      { eformRequestId: requestId, approverId: managerId, role: 'MANAGER_2' },
      { action: 'APPROVED', actionAt: new Date() }
    );

    // Next step: ICT
    request.status = EFormStatus.PENDING_ICT;
    request.currentApproverId = null; // Broadcast to all ICT agents/admins
    const savedRequest = await this.eformRequestRepository.save(request);

    // Emit event for ICT
    this.eventEmitter.emit('eform.manager2-approved', { request: savedRequest });

    return savedRequest;
  }

  async confirmIct(requestId: string, agentId: string, agentName: string, username: string, password: string) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== EFormStatus.PENDING_ICT) throw new BadRequestException('Invalid state');

    // Encrypt Credentials
    const encrypted = this.credentialService.encrypt(`${username}:${password}`);

    // Save Credential Record
    await this.eformCredentialRepository.save({
      eformRequestId: requestId,
      encryptedUsername: encrypted.ciphertext,
      encryptedPassword: encrypted.authTag, // Reusing authTag/iv for storage structure
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      provisionedById: agentId,
    });

    // Update Request Status
    request.status = EFormStatus.CONFIRMED;
    request.resolvedAt = new Date();
    
    // Store in formData for easy frontend display (plaintext display is handled via separate secure endpoint)
    request.formData = { 
      ...request.formData, 
      generatedUsername: username, // For immediate feedback, but secure viewing uses getCredentials
      provisionedAt: new Date()
    };
    
    const savedRequest = await this.eformRequestRepository.save(request);

    // Emit event for User
    this.eventEmitter.emit('eform.ict-confirmed', { request: savedRequest });

    return savedRequest;
  }

  async getCredentials(requestId: string, userId: string) {
    const request = await this.eformRequestRepository.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== userId) throw new ForbiddenException('Access denied');

    const credential = await this.eformCredentialRepository.findOne({ where: { eformRequestId: requestId } });
    if (!credential) throw new NotFoundException('Credentials not ready');

    const decrypted = this.credentialService.decrypt(
      credential.encryptedUsername,
      credential.iv,
      credential.authTag
    );

    const [username, password] = decrypted.split(':');
    return { username, password };
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
        description: `Rejected E-Form Request`,
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
