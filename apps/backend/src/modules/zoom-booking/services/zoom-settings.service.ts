import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ZoomSettings } from '../entities/zoom-settings.entity';
import { UpdateZoomSettingsDto } from '../dto/zoom-settings.dto';

@Injectable()
export class ZoomSettingsService {
    private readonly logger = new Logger(ZoomSettingsService.name);

    constructor(
        @InjectRepository(ZoomSettings)
        private readonly settingsRepo: Repository<ZoomSettings>,
    ) { }

    /**
     * Get current settings (create default if not exists)
     */
    async getSettings(): Promise<ZoomSettings> {
        let settings = await this.settingsRepo.findOne({ where: {} });

        if (!settings) {
            this.logger.log('Creating default Zoom booking settings');
            settings = this.settingsRepo.create({
                defaultDurationMinutes: 60,
                advanceBookingDays: 30,
                slotStartTime: '08:00',
                slotEndTime: '18:00',
                slotIntervalMinutes: 30,
                blockedDates: [],
                workingDays: [1, 2, 3, 4, 5], // Mon-Fri
                requireDescription: false,
                maxBookingPerUserPerDay: 5,
                allowedDurations: [30, 60, 90, 120],
            });
            await this.settingsRepo.save(settings);
        }

        return settings;
    }

    /**
     * Alias for getSettings - used by seeder
     */
    async getOrCreateSettings(): Promise<ZoomSettings> {
        return this.getSettings();
    }

    /**
     * Update settings
     */
    async updateSettings(dto: UpdateZoomSettingsDto): Promise<ZoomSettings> {
        const settings = await this.getSettings();

        Object.assign(settings, dto);

        return this.settingsRepo.save(settings);
    }

    /**
     * Add blocked date (holiday)
     */
    async addBlockedDate(date: string): Promise<ZoomSettings> {
        const settings = await this.getSettings();

        if (!settings.blockedDates.includes(date)) {
            settings.blockedDates = [...settings.blockedDates, date];
            await this.settingsRepo.save(settings);
        }

        return settings;
    }

    /**
     * Remove blocked date
     */
    async removeBlockedDate(date: string): Promise<ZoomSettings> {
        const settings = await this.getSettings();

        settings.blockedDates = settings.blockedDates.filter(d => d !== date);
        await this.settingsRepo.save(settings);

        return settings;
    }

    /**
     * Get available duration options
     */
    async getDurationOptions(): Promise<number[]> {
        const settings = await this.getSettings();
        return settings.allowedDurations;
    }

    /**
     * Check if a date is blocked
     */
    async isDateBlocked(date: string): Promise<boolean> {
        const settings = await this.getSettings();
        return settings.blockedDates.includes(date);
    }

    /**
     * Get public settings for calendar (available to all authenticated users)
     * Returns only settings needed for booking modal, excludes admin-only data
     */
    async getPublicSettings(): Promise<{
        slotStartTime: string;
        slotEndTime: string;
        slotIntervalMinutes: number;
        workingDays: number[];
        advanceBookingDays: number;
        allowedDurations: number[];
    }> {
        const settings = await this.getSettings();
        return {
            slotStartTime: settings.slotStartTime,
            slotEndTime: settings.slotEndTime,
            slotIntervalMinutes: settings.slotIntervalMinutes,
            workingDays: settings.workingDays,
            advanceBookingDays: settings.advanceBookingDays,
            allowedDurations: settings.allowedDurations,
        };
    }
}
