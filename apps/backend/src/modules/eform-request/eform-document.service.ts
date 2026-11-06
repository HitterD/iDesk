import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Not, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { isUUID } from 'class-validator';
import { EFormRequest, EFormStatus } from './entities';
import { EFormRequestService } from './eform-request.service';
import { ICT_ROLES } from './eform-roles.constants';
import { DOCUMENT_NUMBER_MAX, DOCUMENT_NUMBER_PATTERN } from './eform-document-number';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { SiteActor, assertSiteAccess } from '../../shared/core/utils/site-scope.util';
import { validateFileMagicBytes } from '../../shared/core/validators/magic-bytes.validator';

/** Upload folder for GM-signed forms. The /uploads handler refuses it, so files only leave through this service. */
export const GM_APPROVAL_UPLOAD_DIR = 'eform-approvals';
const GM_APPROVAL_PATH = join(process.cwd(), 'uploads', GM_APPROVAL_UPLOAD_DIR);
/** Names multer gives stored files (uuid + .pdf); anything else is refused before touching the disk. */
const STORED_NAME = /^[0-9a-f-]{36}\.pdf$/;
const FILE_NAME_MAX = 200;
/** A signed copy can be replaced while IT has not finished, e.g. after uploading the wrong scan. */
const GM_UPLOAD_STATES = [EFormStatus.PENDING_GM, EFormStatus.PENDING_ICT];
/** A number belongs to a submitted form; an unsigned proposal or a withdrawn one has none to edit. */
const UNNUMBERED_STATES = [EFormStatus.DRAFT, EFormStatus.CANCELLED];

/**
 * The paper side of an e-form: its running document number and the copy the GM signs by hand. Both are IT's to
 * manage; reading the signed copy follows the request's own access rules.
 */
@Injectable()
export class EFormDocumentService {
  private readonly logger = new Logger(EFormDocumentService.name);

  constructor(
    @InjectRepository(EFormRequest) private readonly repo: Repository<EFormRequest>,
    private readonly requests: EFormRequestService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async updateDocumentNumber(actor: SiteActor, id: string, userId: string, raw: string): Promise<EFormRequest> {
    const request = await this.loadForIct(actor, id);
    if (UNNUMBERED_STATES.includes(request.status)) throw new BadRequestException('Usulan yang belum diajukan belum bernomor');
    const documentNumber = raw?.trim() ?? '';
    if (!documentNumber || documentNumber.length > DOCUMENT_NUMBER_MAX || !DOCUMENT_NUMBER_PATTERN.test(documentNumber)) {
      throw new BadRequestException(`Nomor dokumen hanya boleh huruf, angka, dan / . _ - (maks. ${DOCUMENT_NUMBER_MAX} karakter)`);
    }
    if (documentNumber === request.documentNumber) return request;
    const taken = await this.repo.exists({ where: { documentNumber, id: Not(id) } });
    if (taken) throw new ConflictException(`Nomor ${documentNumber} sudah dipakai dokumen lain`);

    const previous = request.documentNumber;
    request.documentNumber = documentNumber;
    let saved: EFormRequest;
    try {
      saved = await this.repo.save(request);
    } catch (err: any) {
      // Two edits racing to the same number: the unique index decides, the loser gets the same answer as above.
      if (err?.code === '23505') throw new ConflictException(`Nomor ${documentNumber} sudah dipakai dokumen lain`);
      throw err;
    }
    this.auditService.logAsync({
      userId,
      action: AuditAction.EFORM_DOCUMENT_NUMBER_UPDATE,
      entityType: 'EFormRequest',
      entityId: id,
      description: 'Changed E-Form document number',
      oldValue: { documentNumber: previous },
      newValue: { documentNumber },
    });
    return saved;
  }

  /**
   * The GM's signature is recorded by uploading the signed form; the first upload hands the request to provisioning.
   * IT may always do it; the requester may too, but only on the paper route (no GM picked to approve in iDesk).
   */
  async uploadGmApproval(actor: SiteActor, id: string, userId: string, file: Express.Multer.File | undefined): Promise<EFormRequest> {
    if (!file) throw new BadRequestException('Pilih berkas PDF yang sudah ditandatangani GM');
    try {
      if (!isUUID(id)) throw new BadRequestException('ID pengajuan tidak valid');
      if (!validateFileMagicBytes(file)) throw new BadRequestException('Berkas bukan PDF yang valid');
      const isIct = ICT_ROLES.includes(actor.role as UserRole);
      const request = await this.loadForUpload(actor, id, userId, isIct);
      if (!GM_UPLOAD_STATES.includes(request.status)) throw new BadRequestException('Pengajuan ini tidak sedang menunggu tanda tangan GM');

      const replaced = request.gmApprovalFile;
      const first = request.status === EFormStatus.PENDING_GM;
      request.gmApprovalFile = file.filename;
      request.gmApprovalFileName = basename(file.originalname || 'ttd-gm.pdf').slice(0, FILE_NAME_MAX);
      request.gmApprovalUploadedById = userId;
      request.gmApprovedAt = new Date();
      if (first) {
        request.status = EFormStatus.PENDING_ICT;
        // The paper copy stands in for an in-app GM approval that was still pending.
        request.currentApproverId = null;
      }
      const saved = await this.repo.save(request);
      if (replaced) await this.removeStored(replaced);

      if (first) this.eventEmitter.emit('eform.gm-approved', { request: saved, userId });
      this.auditService.logAsync({
        userId,
        action: AuditAction.EFORM_APPROVE_MANAGER2,
        entityType: 'EFormRequest',
        entityId: id,
        description: `${first ? 'Uploaded' : 'Replaced'} the GM-signed E-Form${isIct ? '' : ' (by requester)'}`,
        newValue: { fileName: request.gmApprovalFileName },
      });
      delete (saved as Partial<EFormRequest>).gmApprovalFile;
      return saved;
    } catch (err) {
      // Nothing points at a refused upload; drop it instead of leaving an orphan on disk.
      await this.removeStored(file.filename);
      throw err;
    }
  }

  /** The signed copy, for anyone who may open the request itself (requester, approver, IT). */
  async getGmApproval(actor: SiteActor, id: string, userId: string): Promise<{ path: string; fileName: string }> {
    await this.requests.getDetails(actor, id, userId);
    const request = await this.repo.findOne({ where: { id }, select: ['id', 'gmApprovalFile', 'gmApprovalFileName'] });
    if (!request?.gmApprovalFile || !STORED_NAME.test(request.gmApprovalFile)) throw new NotFoundException('Berkas tanda tangan GM belum diunggah');
    return { path: join(GM_APPROVAL_PATH, request.gmApprovalFile), fileName: request.gmApprovalFileName || 'ttd-gm.pdf' };
  }

  private async loadForIct(actor: SiteActor, id: string, withFile = false): Promise<EFormRequest> {
    if (!ICT_ROLES.includes(actor.role as UserRole)) throw new ForbiddenException('Hanya tim ICT yang dapat mengubah dokumen ini');
    const request = await this.repo.findOne({
      where: { id },
      ...(withFile ? { select: this.repo.metadata.columns.map((column) => column.propertyName) as (keyof EFormRequest)[] } : {}),
    });
    if (!request) throw new NotFoundException('Request not found');
    assertSiteAccess(actor, request.siteId);
    return request;
  }

  /** IT (within its site) or the requester on the paper route; anyone else is refused. */
  private async loadForUpload(actor: SiteActor, id: string, userId: string, isIct: boolean): Promise<EFormRequest> {
    if (isIct) return this.loadForIct(actor, id, true);
    const request = await this.repo.findOne({
      where: { id },
      select: this.repo.metadata.columns.map((column) => column.propertyName) as (keyof EFormRequest)[],
    });
    if (!request || request.requesterId !== userId) throw new NotFoundException('Request not found');
    if (request.gmApproverId) throw new ForbiddenException('GM menyetujui langsung di iDesk; berkas tidak perlu diunggah');
    return request;
  }

  private async removeStored(name: string | null | undefined): Promise<void> {
    if (!name || !STORED_NAME.test(name)) return;
    await fs.unlink(join(GM_APPROVAL_PATH, name)).catch((err) => {
      if (err?.code !== 'ENOENT') this.logger.warn(`Could not remove ${name}: ${err?.message ?? err}`);
    });
  }
}
