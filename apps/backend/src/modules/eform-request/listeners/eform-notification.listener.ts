import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { EFormRequest } from '../entities/eform-request.entity';
import { User } from '../../users/entities/user.entity';
import { Site } from '../../sites/entities/site.entity';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../../shared/mail/app-url.util';

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
      await this.notificationCenter.send({ userId: payload.managerId, type: NotificationType.EFORM_SUBMITTED, title: 'Permintaan Akses Baru', message: payload.request.requesterName + ' mengajukan permintaan akses ' + payload.request.formType + ' dan menunggu persetujuan Anda.', referenceId: payload.request.id });
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
    const siteId = (payload.request as any).siteId as string | null;
    try {
      await this.notificationCenter.sendToRoleAtSite('ADMIN', siteId, { type: NotificationType.EFORM_MANAGER2_APPROVED, title: 'Provisioning Akses Diperlukan', message: 'Permintaan ' + payload.request.formType + ' dari ' + payload.request.requesterName + ' telah disetujui dan siap diproses.', referenceId: payload.request.id });
      await this.notificationCenter.sendToRoleAtSite('AGENT_ADMIN', siteId, { type: NotificationType.EFORM_MANAGER2_APPROVED, title: 'Provisioning Akses Diperlukan', message: 'Permintaan ' + payload.request.formType + ' dari ' + payload.request.requesterName + ' telah disetujui dan siap diproses.', referenceId: payload.request.id });
    } catch (error: any) { this.logger.error('Failed to notify ICT for eform.manager-approved: ' + error.message); }
    try {
      const siteLabel = await this.resolveSiteLabel(siteId);
      let ictUsers: any[] = [];
      if (siteId) ictUsers = await this.userRepo.find({ where: [{ role: 'ADMIN' as any, siteId } as any, { role: 'AGENT_ADMIN' as any, siteId } as any] } as any);
      if (!ictUsers.length) ictUsers = await this.userRepo.find({ where: [{ role: 'ADMIN' as any }, { role: 'AGENT_ADMIN' as any }] } as any);
      for (const u of ictUsers) if (u.email) await this.mailDispatch.send({ to: u.email, subject: siteLabel + 'Provisioning Diperlukan - ' + payload.request.formType + ' dari ' + payload.request.requesterName, template: 'eform-request', context: { request: payload.request, recipientName: u.fullName || u.email, link: buildAppUrl('/eform/' + payload.request.id), siteLabel: siteLabel.trim(), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.manager-approved failed: ' + e.message); }
  }
  @OnEvent('eform.ict-confirmed')
  async handleEFormIctConfirmed(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({ userId: payload.request.requesterId, type: NotificationType.EFORM_CREDENTIALS_READY, title: 'Akses ' + payload.request.formType + ' Aktif', message: 'Akses ' + payload.request.formType + ' Anda telah aktif. Buka halaman detail untuk melihat kredensial.', referenceId: payload.request.id });
      this.notificationCenter.emitActionItemsRefresh(payload.request.requesterId, 'EFORM', payload.request.id);
    } catch (error: any) { this.logger.error('Failed to notify requester for eform.ict-confirmed: ' + error.message); }
    try {
      const to = (payload.request as any).requesterEmail; if (to) await this.mailDispatch.send({ to, subject: 'Akses ' + payload.request.formType + ' Aktif', template: 'eform-request', context: { request: payload.request, recipientName: payload.request.requesterName, link: buildAppUrl('/eform/' + payload.request.id), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.ict-confirmed failed: ' + e.message); }
  }
  @OnEvent('eform.rejected')
  async handleEFormRejected(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({ userId: payload.request.requesterId, type: NotificationType.EFORM_REJECTED, title: 'Permintaan Akses Ditolak', message: 'Permintaan akses ' + payload.request.formType + ' Anda ditolak. Alasan: ' + payload.request.rejectionReason, referenceId: payload.request.id });
      this.notificationCenter.emitActionItemsRefresh(payload.request.requesterId, 'EFORM', payload.request.id);
    } catch (error: any) { this.logger.error('Failed to notify requester for eform.rejected: ' + error.message); }
    try {
      const to = (payload.request as any).requesterEmail; if (to) await this.mailDispatch.send({ to, subject: 'Permintaan ' + payload.request.formType + ' Ditolak', template: 'eform-request', context: { request: payload.request, recipientName: payload.request.requesterName, link: buildAppUrl('/eform/' + payload.request.id), year: new Date().getFullYear() } });
    } catch (e: any) { this.logger.warn('Email for eform.rejected failed: ' + e.message); }
  }
}