import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VpnAccess, VpnStatusCreate } from './entities/vpn-access.entity';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType, NotificationCategory } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class VpnSchedulerService {
    private readonly logger = new Logger(VpnSchedulerService.name);

    constructor(
        @InjectRepository(VpnAccess)
        private readonly vpnRepo: Repository<VpnAccess>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly notificationService: NotificationService,
    ) { }

    @Cron('0 8 * * *', { name: 'vpn-reminder-check' })
    async checkVpnExpirations() {
        this.logger.log('Checking VPN expirations (H-1 User / H+1 ICT)...');

        try {
            await this.processExpirations();
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

        const admins = await this.userRepo.find({
            where: { role: In([UserRole.ADMIN, UserRole.MANAGER, UserRole.AGENT]) },
        });

        for (const vpn of activeVpns) {
            const expiry = new Date(vpn.tanggalNonAktif);
            expiry.setUTCHours(0, 0, 0, 0);

            const diffTime = expiry.getTime() - today.getTime();
            const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let needsSave = false;
            const dateStr = new Date().toLocaleDateString('id-ID'); // e.g. "24/2/2026"

            // 1. Check for H-1 (Tomorrow is expiry) or already passed but never sent
            if (daysUntilExpiry <= 1 && !vpn.statusUserH1) {
                // Sent to User (Logically email is sent here, physically tracking in DB)
                vpn.statusUserH1 = `Email Sent ${dateStr}`;
                needsSave = true;
                this.logger.log(`[H-1] Sending expiry warning to User: ${vpn.namaUser}`);

                // Backup existing in-app notification logic just to managers/admins for visibility
                this.sendInAppNotification(
                    admins,
                    vpn,
                    NotificationType.VPN_EXPIRY_D1,
                    `⚠️ VPN Access Expiring SOON: ${vpn.namaUser}`,
                    `VPN access for ${vpn.namaUser} will expire at ${expiry.toLocaleDateString('id-ID')}. H-1 notification marked.`
                );
            }

            // 2. Check for H+1 (Yesterday was expiry, meaning it is currently expired for 1 day)
            // daysUntilExpiry < 0 means it has expired. daysUntilExpiry <= -1 means H+1
            if (daysUntilExpiry <= -1 && !vpn.statusIctH1) {
                vpn.statusIctH1 = `Email Sent ${dateStr}`;
                needsSave = true;
                this.logger.log(`[H+1] Sending expired info to ICT: ${vpn.namaUser}`);

                this.sendInAppNotification(
                    admins,
                    vpn,
                    NotificationType.VPN_EXPIRY_D1, // Using closest valid enum
                    `🚨 VPN Access EXPIRED: ${vpn.namaUser}`,
                    `VPN access for ${vpn.namaUser} has EXPIRED. System marked H+1 for ICT action.`
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

    private async sendInAppNotification(admins: User[], vpn: VpnAccess, type: NotificationType, title: string, message: string) {
        for (const admin of admins) {
            await this.notificationService.create({
                userId: admin.id,
                type,
                category: NotificationCategory.CATEGORY_RENEWAL,
                title,
                message,
                referenceId: vpn.id,
                link: '/vpn-access', // Adjust link if necessary
                requiresAcknowledge: true,
            });
        }
    }

    async triggerReminderCheck(): Promise<void> {
        await this.checkVpnExpirations();
    }
}
