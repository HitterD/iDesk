import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './entities/system-settings.entity';
import { UpdateStorageSettingsDto } from './dto/storage-settings.dto';

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

@Injectable()
export class SettingsService {
    private readonly logger = new Logger(SettingsService.name);

    constructor(
        @InjectRepository(SystemSettings)
        private readonly settingsRepo: Repository<SystemSettings>,
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
            setting.updatedBy = userId || null;
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
        return merged;
    }
}
