import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { EFormRequest, EFormStatus } from '../entities/eform-request.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { Site } from '../../sites/entities/site.entity';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';

/** After the manager the request either waits for the GM (VPN by default, or as ICT set it) or goes to provisioning. */
const awaitsGm = (request: EFormRequest): boolean => request.status === EFormStatus.PENDING_GM;
/** A GM chosen in iDesk approves there; ICT only acts once that GM has approved. */
const awaitsGmInApp = (request: EFormRequest): boolean => awaitsGm(request) && Boolean(request.gmApproverId);
const managerApprovedTitle = (request: EFormRequest): string =>
  awaitsGm(request) ? 'Tanda Tangan GM Diperlukan' : 'Provisioning Diperlukan';

@Injectable()
export class EFormNotificationListener {
  private readonly logger = new Logger(EFormNotificationListener.name);
  constructor(
    private readonly notificationCenter: NotificationCenterService,
    private readonly mailDispatch: MailDispatchService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Site) private readonly siteRepo: Repository<Site>,
  ) {}

  /**
   * Ubah siteId (uuid) menjadi label pendek untuk subject email, mis. "[SPJ] ".
   * Mengembalikan string kosong bila site tidak diketahui agar subject tetap rapi.
   */
  private async resolveSiteLabel(siteId?: string | null): Promise<string> {
    if (!siteId) return '';
    try {
      const site = await this.siteRepo.findOne({ where: { id: siteId } });
      const label = site?.code || site?.name;
      if (!label) {
        this.logger.warn('Site not found for siteId ' + siteId + ', email label omitted');
        return '';
      }
      return '[' + label + '] ';
    } catch (error: any) {
      this.logger.warn('Failed to resolve site label for ' + siteId + ': ' + error.message);
      return '';
    }
  }
  @OnEvent('eform.submitted')
  async handleEFormSubmitted(payload: { request: EFormRequest; managerId: string }) {
    try {
      await this.notificationCenter.send({ userId: payload.managerId, type: NotificationType.EFORM_SUBMITTED, title: 'Permintaan Akses Baru', message: payload.request.requesterName + ' mengajukan permintaan akses ' + payload.request.formType + ' dan menunggu persetujuan Anda.', referenceId: payload.request.id, link: '/eform-access/' + payload.request.id });
    } catch (error: any) { this.logger.error('Failed to notify manager for eform.submitted: ' + error.message); }
    try {
      const mgr: any = await this.userRepo.findOne({ where: { id: payload.managerId } as any });
      const to = mgr?.email; if (to) {
        const siteLabel = await this.resolveSiteLabel((payload.request as any).siteId);
        await this.mailDispatch.send({ to, subject: siteLabel + 'Permintaan Akses Baru - ' + payload.request.formType + ' dari ' + payload.request.requesterName, template: 'eform-request', context: { request: payload.request, recipientName: mgr.fullName || mgr.email, link: buildAppUrl('/eform/' + payload.request.id), siteLabel: siteLabel.trim(), year: new Date().getFullYear() } });
      }
    } catch (e: any) { this.logger.warn('Email for eform.submitted failed: ' + e.message); }
  }
  @OnEvent('eform.manager-approved')
  async handleEFormManagerApproved(payload: { request: EFormRequest }) {
    // The chosen GM is told by eform.gm-requested; ICT hears once the GM approves (eform.gm-approved).
    if (awaitsGmInApp(payload.request)) return;
    await this.notifyIct(payload.request, managerApprovedTitle(payload.request),
      'disetujui atasan. ' + (awaitsGm(payload.request) ? 'Unduh PDF, mintakan tanda tangan GM, lalu unggah berkasnya.' : 'Siap diproses.'));
  }
  @OnEvent('eform.gm-requested')
  async handleEFormGmRequested(payload: { request: EFormRequest; gmId: string }) {
    const { request, gmId } = payload;
    try {
      await this.notificationCenter.send({ userId: gmId, type: NotificationType.EFORM_SUBMITTED, title: 'Persetujuan GM Diperlukan', message: 'Permintaan akses ' + request.formType + ' dari ' + request.requesterName + ' sudah disetujui atasan dan menunggu persetujuan Anda sebagai GM.', referenceId: request.id, link: '/eform-access/' + request.id });
    } catch (error: any) { this.logger.error('Failed to notify GM for eform.gm-requested: ' + error.message); }
    try {
      const gm: any = await this.userRepo.findOne({ where: { id: gmId } as any });
      if (gm?.email) {
        const siteLabel = await this.resolveSiteLabel((request as any).siteId);
        await this.mailDispatch.send({ to: gm.email, subject: siteLabel + 'Persetujuan GM Diperlukan - ' + request.formType + ' dari ' + request.requesterName, template: 'eform-request', context: { request, recipientName: gm.fullName || gm.email, link: buildAppUrl('/eform/' + request.id), siteLabel: siteLabel.trim(), year: new Date().getFullYear() } });
      }
    } catch (e: any) { this.logger.warn('Email for eform.gm-requested failed: ' + e.message); }
  }
  @OnEvent('eform.gm-approved')
  async handleEFormGmApproved(payload: { request: EFormRequest; inApp?: boolean }) {
    // A paper copy is uploaded by ICT itself; only an approval in iDesk needs to reach them.
    if (!payload.inApp) return;
    await this.notifyIct(payload.request, 'Provisioning Diperlukan', 'disetujui atasan dan GM. Siap diproses.');
  }

  /** In-app and email to operational support at the request's site (fail-closed, as for the other ICT notices). */
  private async notifyIct(request: EFormRequest, title: string, what: string): Promise<void> {
    const payload = { request };
    const siteId = (payload.request as any).siteId as string | null;
    try {
      // Next step is IT's. VPN: print the form, get the GM's signature on it, upload the signed PDF. Others: provision.
      await this.notificationCenter.sendToRoleAtSite(UserRole.AGENT_OPERATIONAL_SUPPORT, siteId, { type: NotificationType.EFORM_MANAGER2_APPROVED, title, message: 'Permintaan ' + payload.request.formType + ' dari ' + payload.request.requesterName + ' ' + what, referenceId: payload.request.id, link: '/eform-access/' + payload.request.id });
    } catch (error: any) { this.logger.error('Failed to notify ICT (' + title + '): ' + error.message); }
    try {
      const siteLabel = await this.resolveSiteLabel(siteId);
      // Fail-closed: only query operational support users for the specific site (or cross-site with null siteId).
      const ictUsers: any[] = siteId
        ? await this.userRepo.find({ where: [{ role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, siteId, isActive: true } as any, { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, siteId: IsNull(), isActive: true } as any] } as any)
        : await this.userRepo.find({ where: { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, isActive: true } as any });
      for (const u of ictUsers) if (u.email) await this.mailDispatch.send({ to: u.email, subject: siteLabel + title + ' - ' + payload.request.formType + ' dari ' + payload.request.requesterName, template: 'eform-request', context: { request: payload.request, recipientName: u.fullName || u.email, link: buildAppUrl('/eform/' + payload.request.id), siteLabel: siteLabel.trim(), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email to ICT (' + title + ') failed: ' + e.message); }
  }
  @OnEvent('eform.direct-to-ict')
  async handleEFormDirectToIct(payload: { request: EFormRequest }) {
    const siteId = (payload.request as any).siteId as string | null;
    try {
      await this.notificationCenter.sendToRoleAtSite(UserRole.AGENT_OPERATIONAL_SUPPORT, siteId, { type: NotificationType.EFORM_DIRECT_TO_ICT, title: 'Permintaan Akses Baru', message: 'Permintaan ' + payload.request.formType + ' dari ' + payload.request.requesterName + ' masuk langsung tanpa persetujuan atasan dan siap diproses.', referenceId: payload.request.id, link: '/eform-access/' + payload.request.id });
    } catch (error: any) { this.logger.error('Failed to notify ICT for eform.direct-to-ict: ' + error.message); }
    try {
      const siteLabel = await this.resolveSiteLabel(siteId);
      // Fail-closed: only query operational support users for the specific site (or cross-site with null siteId).
      const ictUsers: any[] = siteId
        ? await this.userRepo.find({ where: [{ role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, siteId, isActive: true } as any, { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, siteId: IsNull(), isActive: true } as any] } as any)
        : await this.userRepo.find({ where: { role: UserRole.AGENT_OPERATIONAL_SUPPORT as any, isActive: true } as any });
      for (const u of ictUsers) if (u.email) await this.mailDispatch.send({ to: u.email, subject: siteLabel + 'Provisioning Diperlukan - ' + payload.request.formType + ' dari ' + payload.request.requesterName, template: 'eform-request', context: { request: payload.request, recipientName: u.fullName || u.email, link: buildAppUrl('/eform/' + payload.request.id), siteLabel: siteLabel.trim(), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.direct-to-ict failed: ' + e.message); }
  }
  @OnEvent('eform.fulfilled')
  async handleEFormFulfilled(payload: { request: EFormRequest }) {
    const notes = (payload.request as any).formData?.fulfillmentNotes as string | undefined;
    try {
      await this.notificationCenter.send({ userId: payload.request.requesterId, type: NotificationType.EFORM_FULFILLED, title: 'Akses ' + payload.request.formType + ' Aktif', message: 'Akses ' + payload.request.formType + ' Anda telah ditambahkan pada akun yang sudah ada.' + (notes ? ' Catatan ICT: ' + notes : ''), referenceId: payload.request.id, link: '/eform-access/' + payload.request.id });
      this.notificationCenter.emitActionItemsRefresh(payload.request.requesterId, 'EFORM', payload.request.id);
    } catch (error: any) { this.logger.error('Failed to notify requester for eform.fulfilled: ' + error.message); }
    try {
      const to = (payload.request as any).requesterEmail; if (to) await this.mailDispatch.send({ to, subject: 'Akses ' + payload.request.formType + ' Aktif', template: 'eform-request', context: { request: payload.request, recipientName: payload.request.requesterName, link: buildAppUrl('/eform/' + payload.request.id), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.fulfilled failed: ' + e.message); }
  }
  @OnEvent('eform.ict-confirmed')
  async handleEFormIctConfirmed(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({ userId: payload.request.requesterId, type: NotificationType.EFORM_CREDENTIALS_READY, title: 'Akses ' + payload.request.formType + ' Aktif', message: 'Akses ' + payload.request.formType + ' Anda telah aktif. Buka halaman detail untuk melihat kredensial.', referenceId: payload.request.id, link: '/eform-access/' + payload.request.id });
      this.notificationCenter.emitActionItemsRefresh(payload.request.requesterId, 'EFORM', payload.request.id);
    } catch (error: any) { this.logger.error('Failed to notify requester for eform.ict-confirmed: ' + error.message); }
    try {
      const to = (payload.request as any).requesterEmail; if (to) await this.mailDispatch.send({ to, subject: 'Akses ' + payload.request.formType + ' Aktif', template: 'eform-request', context: { request: payload.request, recipientName: payload.request.requesterName, link: buildAppUrl('/eform/' + payload.request.id), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.ict-confirmed failed: ' + e.message); }
  }
  @OnEvent('eform.rejected')
  async handleEFormRejected(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({ userId: payload.request.requesterId, type: NotificationType.EFORM_REJECTED, title: 'Permintaan Akses Ditolak', message: 'Permintaan akses ' + payload.request.formType + ' Anda ditolak. Alasan: ' + payload.request.rejectionReason, referenceId: payload.request.id, link: '/eform-access/' + payload.request.id });
      this.notificationCenter.emitActionItemsRefresh(payload.request.requesterId, 'EFORM', payload.request.id);
    } catch (error: any) { this.logger.error('Failed to notify requester for eform.rejected: ' + error.message); }
    try {
      const to = (payload.request as any).requesterEmail; if (to) await this.mailDispatch.send({ to, subject: 'Permintaan ' + payload.request.formType + ' Ditolak', template: 'eform-request', context: { request: payload.request, recipientName: payload.request.requesterName, link: buildAppUrl('/eform/' + payload.request.id), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.rejected failed: ' + e.message); }
  }
}