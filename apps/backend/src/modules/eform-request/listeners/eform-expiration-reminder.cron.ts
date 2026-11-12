import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EFormRequest, EFormStatus } from '../entities';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { runOncePerPeriod } from '../../../shared/core/utils/run-exclusive';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class EFormExpirationReminderCron {
  private readonly logger = new Logger(EFormExpirationReminderCron.name);

  constructor(
    @InjectRepository(EFormRequest)
    private readonly eformRepo: Repository<EFormRequest>,
    private readonly notificationCenter: NotificationCenterService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('30 7 * * *', { timeZone: 'Asia/Jakarta', name: 'eform-expiration-reminder' })
  async runDaily() {
    this.logger.log('Starting daily E-Form expiration reminder scan...');
    try {
      // Once per WIB day across replicas and restarts.
      const scannedCount = await runOncePerPeriod(this.dataSource, 'eform-expiration-reminder', localDateKey(new Date(), DEFAULT_TIMEZONE), () => this.scanAndNotify());
      if (scannedCount === undefined) {
        this.logger.log('E-Form expiration reminders already sent today; skipped.');
        return;
      }
      this.logger.log(`E-Form expiration reminder scan completed. Sent ${scannedCount} reminders.`);
    } catch (error: any) {
      this.logger.error(`Error during E-Form expiration reminder scan: ${error.message}`, error.stack);
    }
  }

  /**
   * Helper function to parse YYYY-MM-DD into start of day in local/UTC without timezone offset distortion
   */
  private parseLocalDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    const date = new Date();
    date.setFullYear(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  async scanAndNotify(): Promise<number> {
    const confirmedRequests = await this.eformRepo.find({
      where: { status: EFormStatus.CONFIRMED },
    });

    if (confirmedRequests.length === 0) {
      return 0;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let reminderCount = 0;

    for (const req of confirmedRequests) {
      const sampaiTanggalStr = req.formData?.sampaiTanggal;
      if (!sampaiTanggalStr) {
        // Permanent access (e.g. Website permanent), skip
        continue;
      }

      const endDate = this.parseLocalDate(sampaiTanggalStr);
      if (!endDate) continue;

      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let reminderTitle = '';
      let reminderMessageForUser = '';
      let reminderMessageForIct = '';

      if (diffDays === 7) {
        reminderTitle = `Pengingat: Akses ${req.formType} Berakhir dalam 7 Hari`;
        reminderMessageForUser = `Akses ${req.formType} Anda (#${req.id.slice(0, 8).toUpperCase()}) akan berakhir pada ${sampaiTanggalStr} (7 hari lagi). Ajukan perpanjangan jika masih dibutuhkan.`;
        reminderMessageForIct = `Akses ${req.formType} untuk ${req.requesterName} (#${req.id.slice(0, 8).toUpperCase()}) akan berakhir dalam 7 hari (${sampaiTanggalStr}).`;
      } else if (diffDays === 3) {
        reminderTitle = `Peringatan: Akses ${req.formType} Berakhir dalam 3 Hari`;
        reminderMessageForUser = `Akses ${req.formType} Anda (#${req.id.slice(0, 8).toUpperCase()}) akan segera berakhir pada ${sampaiTanggalStr} (3 hari lagi). Segera ajukan perpanjangan agar akses tidak terputus.`;
        reminderMessageForIct = `Akses ${req.formType} untuk ${req.requesterName} (#${req.id.slice(0, 8).toUpperCase()}) akan segera berakhir dalam 3 hari (${sampaiTanggalStr}).`;
      } else if (diffDays === 0) {
        reminderTitle = `Pemberitahuan: Akses ${req.formType} Berakhir Hari Ini`;
        reminderMessageForUser = `Masa berlaku akses ${req.formType} Anda (#${req.id.slice(0, 8).toUpperCase()}) berakhir hari ini (${sampaiTanggalStr}).`;
        reminderMessageForIct = `Masa berlaku akses ${req.formType} untuk ${req.requesterName} (#${req.id.slice(0, 8).toUpperCase()}) berakhir hari ini (${sampaiTanggalStr}). Harap verifikasi penutupan/pencabutan akses.`;
      }

      if (reminderTitle) {
        reminderCount++;

        // 1. Notify user pemohon
        if (req.requesterId) {
          try {
            await this.notificationCenter.send({
              userId: req.requesterId,
              type: NotificationType.EFORM_EXPIRY_REMINDER,
              title: reminderTitle,
              message: reminderMessageForUser,
              referenceId: req.id,
              link: `/eform-access/${req.id}`,
            });
          } catch (err: any) {
            this.logger.warn(`Failed to send reminder to user ${req.requesterId}: ${err.message}`);
          }
        }

        // 2. ICT only on the last day, to verify the access is closed: operational support at the request's
        //    site plus cross-site staff (fail-closed when the request has no site). H-7/H-3 are the requester's.
        if (diffDays === 0) {
          try {
            const ictUsers = await this.notificationCenter.findStaffAtSite(
              [UserRole.AGENT_OPERATIONAL_SUPPORT], req.siteId, req.requesterId ? [req.requesterId] : [],
            );
            await this.notificationCenter.sendBulk(ictUsers.map(u => u.id), {
              type: NotificationType.EFORM_EXPIRY_REMINDER,
              title: reminderTitle,
              message: reminderMessageForIct,
              referenceId: req.id,
              link: `/eform-access/${req.id}`,
            });
          } catch (err: any) {
            this.logger.warn(`Failed to send expiry reminder to ICT for ${req.id}: ${err.message}`);
          }
        }
      }
    }

    return reminderCount;
  }
}
