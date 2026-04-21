import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ZoomAccountService } from '../services/zoom-account.service';
import { ZoomSettingsService } from '../services/zoom-settings.service';

/**
 * Seeder that runs on application bootstrap to initialize
 * 10 default Zoom accounts if none exist
 */
@Injectable()
export class ZoomBootstrapSeeder implements OnApplicationBootstrap {
    private readonly logger = new Logger(ZoomBootstrapSeeder.name);

    constructor(
        private readonly accountService: ZoomAccountService,
        private readonly settingsService: ZoomSettingsService,
    ) { }

    async onApplicationBootstrap() {
        await this.seedZoomAccounts();
        await this.seedZoomSettings();
    }

    /**
     * Initialize 10 Zoom accounts with default naming
     */
    private async seedZoomAccounts() {
        try {
            const accounts = await this.accountService.findAll();

            if (accounts.length > 0) {
                this.logger.log(`Zoom accounts already exist (${accounts.length}), skipping seed`);
                return;
            }

            // Default placeholder emails - admin should update these
            const defaultEmails = [
                'zoom1@company.com',
                'zoom2@company.com',
                'zoom3@company.com',
                'zoom4@company.com',
                'zoom5@company.com',
                'zoom6@company.com',
                'zoom7@company.com',
                'zoom8@company.com',
                'zoom9@company.com',
                'zoom10@company.com',
            ];

            await this.accountService.initializeDefaultAccounts(defaultEmails);
            this.logger.log('✅ Seeded 10 default Zoom accounts');
        } catch (error) {
            this.logger.error('Failed to seed Zoom accounts:', error);
        }
    }

    /**
     * Ensure default settings exist
     */
    private async seedZoomSettings() {
        try {
            await this.settingsService.getOrCreateSettings();
            this.logger.log('✅ Zoom settings initialized');
        } catch (error) {
            this.logger.error('Failed to seed Zoom settings:', error);
        }
    }
}
