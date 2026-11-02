import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { EFormApproval, EFormRequest, EFormSignature, EFormStatus } from './entities';
import { ApproveManagerDto, SetGmStepDto } from './dto';
import { EFormRequestService } from './eform-request.service';
import { ICT_ROLES } from './eform-roles.constants';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor, assertSiteAccess } from '../../shared/core/utils/site-scope.util';

const GM_ROLE = 'GM';
const GM_SEQUENCE = 3;
/** Where ICT may still turn the GM step on or off: before the manager, while waiting on the GM, or before provisioning. */
const GM_EDITABLE_STATES = [EFormStatus.PENDING_MANAGER, EFormStatus.PENDING_GM, EFormStatus.PENDING_ICT];

/**
 * The GM step of an e-form. It is on by default for VPN and ICT may switch it for any request. A GM picked by the
 * requester or ICT approves in iDesk; with no GM picked, ICT uploads the paper-signed form (EFormDocumentService).
 */
@Injectable()
export class EFormGmService {
  constructor(
    @InjectRepository(EFormRequest) private readonly repo: Repository<EFormRequest>,
    @InjectRepository(EFormApproval) private readonly approvals: Repository<EFormApproval>,
    @InjectRepository(EFormSignature) private readonly signatures: Repository<EFormSignature>,
    private readonly requests: EFormRequestService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** The chosen GM approves (with a signature) or rejects in iDesk. */
  async approveByGm(requestId: string, gmId: string, gmName: string, dto: ApproveManagerDto): Promise<EFormRequest> {
    const request = await this.repo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== EFormStatus.PENDING_GM) throw new BadRequestException('Invalid state');
    if (!request.gmApproverId || request.currentApproverId !== gmId) throw new ForbiddenException('Not your approval');

    const pending = { eformRequestId: requestId, approverId: gmId, role: GM_ROLE, action: 'PENDING' };
    if (dto.action === 'REJECT') {
      request.status = EFormStatus.REJECTED;
      request.rejectionReason = dto.rejectionReason || '';
      const saved = await this.repo.save(request);
      await this.approvals.update(pending, { action: 'REJECTED', actionAt: new Date(), notes: dto.rejectionReason });
      this.eventEmitter.emit('eform.rejected', { request: saved, userId: gmId });
      return saved;
    }

    if (!dto.signatureData) throw new BadRequestException('Tanda tangan GM wajib diisi');
    await this.signatures.save({ eformRequestId: requestId, signerId: gmId, signerName: gmName, signatureData: dto.signatureData, signerRole: GM_ROLE });
    await this.approvals.update(pending, { action: 'APPROVED', actionAt: new Date() });

    request.status = EFormStatus.PENDING_ICT;
    request.currentApproverId = null;
    request.gmApprovedAt = new Date();
    const saved = await this.repo.save(request);
    this.eventEmitter.emit('eform.gm-approved', { request: saved, userId: gmId, inApp: true });
    this.auditService.logAsync({
      userId: gmId,
      action: AuditAction.EFORM_APPROVE_MANAGER2,
      entityType: 'EFormRequest',
      entityId: requestId,
      description: 'GM approved the E-Form in iDesk',
    });
    return saved;
  }

  /** ICT turns the GM step on or off and picks (or clears) the GM. */
  async setGmStep(actor: SiteActor, requestId: string, userId: string, dto: SetGmStepDto): Promise<EFormRequest> {
    if (!ICT_ROLES.includes(actor.role as UserRole)) throw new ForbiddenException('Hanya tim ICT yang dapat mengatur persetujuan GM');
    const request = await this.repo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    assertSiteAccess(actor, request.siteId);
    if (!GM_EDITABLE_STATES.includes(request.status)) throw new BadRequestException('Persetujuan GM tidak bisa diubah pada status ini');

    const gmApproverId = dto.requiresGm ? dto.gmApproverId ?? null : null;
    if (gmApproverId) await this.requests.assertActiveUser(gmApproverId, request.requesterId);
    if (request.status === EFormStatus.PENDING_ICT && dto.requiresGm && request.gmApprovedAt) {
      throw new BadRequestException('GM sudah menyetujui pengajuan ini');
    }

    const previous = { requiresGm: request.requiresGm, gmApproverId: request.gmApproverId };
    request.requiresGm = dto.requiresGm;
    request.gmApproverId = gmApproverId;
    const askGm = this.moveForGmStep(request);
    const saved = await this.repo.save(request);
    await this.syncPendingApproval(saved, askGm);

    this.auditService.logAsync({
      userId,
      action: AuditAction.EFORM_GM_STEP_UPDATE,
      entityType: 'EFormRequest',
      entityId: requestId,
      description: dto.requiresGm ? 'Required GM approval on the E-Form' : 'Skipped GM approval on the E-Form',
      oldValue: previous,
      newValue: { requiresGm: saved.requiresGm, gmApproverId: saved.gmApproverId },
    });
    return saved;
  }

  /** Moves a request already past the manager to match the new GM setting; true when the GM must now be asked. */
  private moveForGmStep(request: EFormRequest): boolean {
    if (request.status === EFormStatus.PENDING_MANAGER) return false;
    if (!request.requiresGm) {
      request.status = EFormStatus.PENDING_ICT;
      request.currentApproverId = null;
      return false;
    }
    request.status = EFormStatus.PENDING_GM;
    request.currentApproverId = request.gmApproverId;
    return Boolean(request.gmApproverId);
  }

  /** Keeps a single pending GM approval row, for the GM now asked (if any), and tells that GM. */
  private async syncPendingApproval(request: EFormRequest, askGm: boolean): Promise<void> {
    const pending = await this.approvals.findOne({ where: { eformRequestId: request.id, role: GM_ROLE, action: 'PENDING' } });
    if (pending && (!askGm || pending.approverId !== request.gmApproverId)) await this.approvals.delete(pending.id);
    if (!askGm || pending?.approverId === request.gmApproverId) return;
    await this.approvals.save({ eformRequestId: request.id, approverId: request.gmApproverId!, role: GM_ROLE, action: 'PENDING', sequence: GM_SEQUENCE });
    this.eventEmitter.emit('eform.gm-requested', { request, gmId: request.gmApproverId });
  }
}
