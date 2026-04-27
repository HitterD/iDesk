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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      this.logger.error(`Failed to notify requester for eform.rejected: ${error.message}`);
    }
  }
}
