import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system-settings.entity';
import { UpdateStorageSettingsDto } from './dto/storage-settings.dto';
import { SchedulingConfig } from './dto/scheduling-config.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

export interface StorageSettings {
    autoCleanupEnabled: boolean;
    attachments: {
        enabled: boolean;
        retentionDays: number;
        onlyResolvedTickets: boolean;
    };
    notes: {
        enabled: boolean;
        retentionDays: number;
        onlyResolvedTickets: boolean;
    };
    discussions: {
        enabled: boolean;
        retentionDays: number;
        onlyResolvedTickets: boolean;
    };
}

const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
    autoCleanupEnabled: false,
    attachments: {
        enabled: true,
        retentionDays: 90, // 3 months
        onlyResolvedTickets: true,
    },
    notes: {
        enabled: true,
        retentionDays: 90,
        onlyResolvedTickets: true,
    },
    discussions: {
        enabled: true,
        retentionDays: 90,
        onlyResolvedTickets: true,
    },
};

const DEFAULT_SCHEDULING_CONFIG: SchedulingConfig = {
    timeSlots: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00'],
    hardwareTypes: ['PC', 'IP-Phone', 'Printer'],
};

@Injectable()
export class SettingsService {
    private readonly logger = new Logger(SettingsService.name);

    constructor(
        @InjectRepository(SystemSettings)
        private readonly settingsRepo: Repository<SystemSettings>,
        private readonly auditService: AuditService,
    ) { }

    async getSetting<T>(key: string, defaultValue?: T): Promise<T | null> {
        const setting = await this.settingsRepo.findOne({ where: { key } });
        if (!setting) {
            return defaultValue ?? null;
        }
        return setting.value as T;
    }

    async setSetting(key: string, value: any, userId?: string, description?: string): Promise<SystemSettings> {
        let setting = await this.settingsRepo.findOne({ where: { key } });

        if (setting) {
            setting.value = value;
            setting.updatedBy = userId || "system";
        } else {
            setting = this.settingsRepo.create({
                key,
                value,
                description,
                updatedBy: userId,
            });
        }

        return this.settingsRepo.save(setting);
    }

    async deleteSetting(key: string): Promise<boolean> {
        const result = await this.settingsRepo.delete({ key });
        return (result.affected || 0) > 0;
    }

    // Storage-specific methods
    async getStorageSettings(): Promise<StorageSettings> {
        const settings = await this.getSetting<StorageSettings>('storage.retention');
        return settings || DEFAULT_STORAGE_SETTINGS;
    }

    async updateStorageSettings(updates: UpdateStorageSettingsDto, userId?: string): Promise<StorageSettings> {
        const current = await this.getStorageSettings();
        const merged: StorageSettings = {
            autoCleanupEnabled: updates.autoCleanupEnabled ?? current.autoCleanupEnabled,
            attachments: {
                enabled: updates.attachments?.enabled ?? current.attachments.enabled,
                retentionDays: updates.attachments?.retentionDays ?? current.attachments.retentionDays,
                onlyResolvedTickets: updates.attachments?.onlyResolvedTickets ?? current.attachments.onlyResolvedTickets,
            },
            notes: {
                enabled: updates.notes?.enabled ?? current.notes.enabled,
                retentionDays: updates.notes?.retentionDays ?? current.notes.retentionDays,
                onlyResolvedTickets: updates.notes?.onlyResolvedTickets ?? current.notes.onlyResolvedTickets,
            },
            discussions: {
                enabled: updates.discussions?.enabled ?? current.discussions.enabled,
                retentionDays: updates.discussions?.retentionDays ?? current.discussions.retentionDays,
                onlyResolvedTickets: updates.discussions?.onlyResolvedTickets ?? current.discussions.onlyResolvedTickets,
            },
        };

        await this.setSetting('storage.retention', merged, userId, 'Storage retention settings');

        // Audit log for storage settings change
        this.auditService.logAsync({
            userId: userId || 'system',
            action: AuditAction.SETTINGS_CHANGE,
            entityType: 'settings',
            entityId: 'storage.retention',
            oldValue: current,
            newValue: merged,
            description: 'Storage retention settings updated',
        });

        return merged;
    }

    // =====================
    // Scheduling Settings
    // =====================

    async getSchedulingConfig(): Promise<SchedulingConfig> {
        const config = await this.getSetting<SchedulingConfig>('scheduling.config');
        return config || DEFAULT_SCHEDULING_CONFIG;
    }

    async getTimeSlots(): Promise<string[]> {
        const config = await this.getSchedulingConfig();
        return config.timeSlots;
    }

    async updateTimeSlots(timeSlots: string[], userId?: string): Promise<SchedulingConfig> {
        const current = await this.getSchedulingConfig();
        const updated: SchedulingConfig = {
            ...current,
            timeSlots,
        };
        await this.setSetting('scheduling.config', updated, userId, 'Scheduling configuration');
        this.logger.log(`Time slots updated by user ${userId}: ${timeSlots.join(', ')}`);

        // Audit log for time slots change
        this.auditService.logAsync({
            userId: userId || 'system',
            action: AuditAction.SETTINGS_CHANGE,
            entityType: 'settings',
            entityId: 'scheduling.timeSlots',
            oldValue: { timeSlots: current.timeSlots },
            newValue: { timeSlots },
            description: `Scheduling time slots updated`,
        });

        return updated;
    }

    async getHardwareTypes(): Promise<string[]> {
        const config = await this.getSchedulingConfig();
        return config.hardwareTypes;
    }

    async updateHardwareTypes(hardwareTypes: string[], userId?: string): Promise<SchedulingConfig> {
        const current = await this.getSchedulingConfig();
        const updated: SchedulingConfig = {
            ...current,
            hardwareTypes,
        };
        await this.setSetting('scheduling.config', updated, userId, 'Scheduling configuration');
        this.logger.log(`Hardware types updated by user ${userId}: ${hardwareTypes.join(', ')}`);

        // Audit log for hardware types change
        this.auditService.logAsync({
            userId: userId || 'system',
            action: AuditAction.SETTINGS_CHANGE,
            entityType: 'settings',
            entityId: 'scheduling.hardwareTypes',
            oldValue: { hardwareTypes: current.hardwareTypes },
            newValue: { hardwareTypes },
            description: `Scheduling hardware types updated`,
        });

        return updated;
    }
}
