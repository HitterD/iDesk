import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EFormRequest, EFormStatus } from '../entities';
import { User } from '../../users/entities/user.entity';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { ICT_ROLES } from '../eform-roles.constants';

@Injectable()
export class EFormExpirationReminderCron {
  private readonly logger = new Logger(EFormExpirationReminderCron.name);

  constructor(
    @InjectRepository(EFormRequest)
    private readonly eformRepo: Repository<EFormRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  @Cron('30 7 * * *', { timeZone: 'Asia/Jakarta', name: 'eform-expiration-reminder' })
  async runDaily() {
    this.logger.log('Starting daily E-Form expiration reminder scan...');
    try {
      const scannedCount = await this.scanAndNotify();
      this.logger.log(`E-Form expiration reminder scan completed. Processed ${scannedCount} confirmed requests.`);
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

    // Fetch active ICT admins/agents to notify in bulk
    const ictUsers = await this.userRepo.find({
      where: {
        role: In(ICT_ROLES as any),
        isActive: true,
      },
      select: ['id', 'email', 'fullName'],
    });
    const ictUserIds = ictUsers.map(u => u.id);

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
              type: NotificationType.SYSTEM,
              title: reminderTitle,
              message: reminderMessageForUser,
              referenceId: req.id,
            });
          } catch (err: any) {
            this.logger.warn(`Failed to send reminder to user ${req.requesterId}: ${err.message}`);
          }
        }

        // 2. Notify ICT agent/admins in bulk
        if (ictUserIds.length > 0) {
          try {
            await this.notificationCenter.sendBulk(ictUserIds, {
              type: NotificationType.SYSTEM,
              title: reminderTitle,
              message: reminderMessageForIct,
              referenceId: req.id,
            });
          } catch (err: any) {
            this.logger.warn(`Failed to send bulk reminder to ICT users: ${err.message}`);
          }
        }
      }
    }

    return reminderCount;
  }
}
