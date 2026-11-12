import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { VpnAccess, VpnStatusCreate } from './entities/vpn-access.entity';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType, NotificationCategory } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { NotificationCenterService } from '../notifications/notification-center.service';
import { runOncePerPeriod } from '../../shared/core/utils/run-exclusive';
import { DEFAULT_TIMEZONE, localDateKey } from '../sla-config/business-hours.calc';

@Injectable()
export class VpnSchedulerService {
    private readonly logger = new Logger(VpnSchedulerService.name);

    constructor(
        @InjectRepository(VpnAccess)
        private readonly vpnRepo: Repository<VpnAccess>,
        private readonly notificationService: NotificationService,
        private readonly notificationCenter: NotificationCenterService,
        private readonly dataSource: DataSource,
    ) { }

    @Cron('0 8 * * *', { name: 'vpn-reminder-check', timeZone: 'Asia/Jakarta' })
    async checkVpnExpirations() {
        this.logger.log('Checking VPN expirations (H-1 User / H+1 ICT)...');

        try {
            // Once per WIB day across replicas and restarts.
            const ran = await runOncePerPeriod(this.dataSource, 'vpn-reminder-check', localDateKey(new Date(), DEFAULT_TIMEZONE), async () => {
                await this.processExpirations();
                return true;
            });
            if (!ran) this.logger.log('VPN reminders already checked today; skipped.');
        } catch (error) {
            this.logger.error('Failed to check VPN expirations:', error);
        }
    }

    private async processExpirations(): Promise<void> {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // Get all unarchived / non-actioned VPNs
        const activeVpns = await this.vpnRepo.find({
            where: { statusCreateVpn: In([VpnStatusCreate.SELESAI, VpnStatusCreate.PROSES]) },
        });

        // Active people who work the VPN tab of the Renewal Hub - not every staff account.
        const admins = await this.notificationCenter.findUsersWithPageAccess('renewal');

        for (const vpn of activeVpns) {
            const expiry = new Date(vpn.tanggalNonAktif);
            expiry.setUTCHours(0, 0, 0, 0);

            const diffTime = expiry.getTime() - today.getTime();
            const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let needsSave = false;
            const dateStr = new Date().toLocaleDateString('id-ID'); // e.g. "24/2/2026"

            // 1. Check for H-1 (Tomorrow is expiry) or already passed but never sent
            if (daysUntilExpiry <= 1 && !vpn.statusUserH1) {
                // Marks the H-1 step as done (no email is sent from here).
                vpn.statusUserH1 = `Notified ${dateStr}`;
                needsSave = true;
                this.logger.log(`[H-1] Sending expiry warning to User: ${vpn.namaUser}`);

                await this.sendInAppNotification(
                    admins,
                    vpn,
                    NotificationType.VPN_EXPIRY_D1,
                    `Akses VPN segera berakhir: ${vpn.namaUser}`,
                    `Akses VPN ${vpn.namaUser} berakhir pada ${expiry.toLocaleDateString('id-ID')}.`,
                    true,
                );
            }

            // 2. Check for H+1 (Yesterday was expiry, meaning it is currently expired for 1 day)
            // daysUntilExpiry < 0 means it has expired. daysUntilExpiry <= -1 means H+1
            if (daysUntilExpiry <= -1 && !vpn.statusIctH1) {
                vpn.statusIctH1 = `Notified ${dateStr}`;
                needsSave = true;
                this.logger.log(`[H+1] Sending expired info to ICT: ${vpn.namaUser}`);

                // Expired: ICT must close the account.
                await this.sendInAppNotification(
                    admins,
                    vpn,
                    NotificationType.VPN_EXPIRY_D1, // Using closest valid enum
                    `Akses VPN sudah berakhir: ${vpn.namaUser}`,
                    `Akses VPN ${vpn.namaUser} sudah berakhir. Nonaktifkan akunnya.`,
                    true,
                );
            }

            // 3. Auto-Archive (If keterangan is filled manually, and it is past expiry day, mark as NON_AKTIF)
            if (daysUntilExpiry < 0 && vpn.keteranganNonAktifVpn && vpn.keteranganNonAktifVpn.trim() !== '') {
                vpn.statusCreateVpn = VpnStatusCreate.NON_AKTIF;
                needsSave = true;
                this.logger.log(`[Auto-Archive] Archiving VPN for ${vpn.namaUser} to NON_AKTIF due to existing remarks.`);
            }

            if (needsSave) {
                await this.vpnRepo.save(vpn);
            }
        }
    }

    private async sendInAppNotification(admins: User[], vpn: VpnAccess, type: NotificationType, title: string, message: string, requiresAcknowledge: boolean) {
        for (const admin of admins) {
            await this.notificationService.create({
                userId: admin.id,
                type,
                category: NotificationCategory.CATEGORY_RENEWAL,
                title,
                message,
                referenceId: vpn.id,
                link: '/renewal?tab=vpn',
                requiresAcknowledge,
            });
        }
    }

    async triggerReminderCheck(): Promise<void> {
        await this.checkVpnExpirations();
    }
}
