import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
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
        title: 'Permintaan VPN Baru',
        message: `${payload.request.requesterName} mengajukan akses VPN baru dan menunggu persetujuan Anda.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for eform.submitted: ${error.message}`);
    }
  }

  @OnEvent('eform.manager1-approved')
  async handleEFormManager1Approved(payload: { request: EFormRequest; managerId: string }) {
    try {
      await this.notificationCenter.send({
        userId: payload.managerId,
        type: NotificationType.EFORM_MANAGER1_APPROVED,
        title: 'Persetujuan Lanjutan VPN',
        message: `Permintaan VPN dari ${payload.request.requesterName} menunggu persetujuan Anda.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for eform.manager1-approved: ${error.message}`);
    }
  }

  @OnEvent('eform.manager2-approved')
  async handleEFormManager2Approved(payload: { request: EFormRequest }) {
    try {
      // Notify All ICT Agents/Admins (simplified by sending to a specific role if your system supports it, 
      // or fetching user IDs with ICT role)
      await this.notificationCenter.sendToRole('AGENT', {
        type: NotificationType.EFORM_MANAGER2_APPROVED,
        title: 'Provisioning VPN Diperlukan',
        message: `Permintaan VPN dari ${payload.request.requesterName} telah disetujui GM dan siap diproses.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for eform.manager2-approved: ${error.message}`);
    }
  }

  @OnEvent('eform.ict-confirmed')
  async handleEFormIctConfirmed(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({
        userId: payload.request.requesterId,
        type: NotificationType.EFORM_CREDENTIALS_READY,
        title: 'Akses VPN Aktif',
        message: `Selamat! Akses VPN Anda telah aktif. Silakan buka aplikasi untuk melihat kredensial Anda.`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for eform.ict-confirmed: ${error.message}`);
    }
  }

  @OnEvent('eform.rejected')
  async handleEFormRejected(payload: { request: EFormRequest }) {
    try {
      await this.notificationCenter.send({
        userId: payload.request.requesterId,
        type: NotificationType.EFORM_REJECTED,
        title: 'Permintaan VPN Ditolak',
        message: `Maaf, permintaan akses VPN Anda ditolak. Alasan: ${payload.request.rejectionReason}`,
        referenceId: payload.request.id,
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for eform.rejected: ${error.message}`);
    }
  }
}
