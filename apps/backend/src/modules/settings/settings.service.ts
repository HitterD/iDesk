import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SystemSettings } from './entities/system-settings.entity';
import { UpdateStorageSettingsDto } from './dto/storage-settings.dto';
import { SchedulingConfig } from './dto/scheduling-config.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { CacheService } from '../../shared/core/cache';

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
    imageCompression: {
        enabled: boolean;
        retentionDays: number;
        onlyResolvedTickets: boolean;
        quality: number;
        maxWidth: number;
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
    imageCompression: {
        enabled: true,
        retentionDays: 90,
        onlyResolvedTickets: true,
        quality: 80,
        maxWidth: 1600,
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
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly auditService: AuditService,
        private readonly cacheService: CacheService,
    ) { }

    async getSetting<T>(key: string, defaultValue?: T): Promise<T | null> {
        const setting = await this.settingsRepo.findOne({ where: { key } });
        if (!setting) {
            return defaultValue ?? null;
        }
        return setting.value as T;
    }

    async setSetting(key: string, value: any, userId?: string, description?: string): Promise<SystemSettings> {
        // P1 fix: was find-then-save (read-modify-write) with no transaction.
        // A concurrent writer could clobber the value between read and save.
        // Now the read + conditional update + insert-on-miss happen in a
        // single transaction. For higher-throughput callers, follow-up plans
        // can introduce an upsert helper that uses a single SQL statement.
        return this.dataSource.transaction(async (manager) => {
            const setting = await manager.findOne(SystemSettings, { where: { key } });

            if (setting) {
                setting.value = value;
                setting.updatedBy = userId || 'system';
                return manager.save(SystemSettings, setting);
            }
            const created = manager.create(SystemSettings, {
                key,
                value,
                description,
                updatedBy: userId,
            });
            return manager.save(SystemSettings, created);
        });
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
            imageCompression: {
                enabled: updates.imageCompression?.enabled ?? current.imageCompression?.enabled ?? DEFAULT_STORAGE_SETTINGS.imageCompression.enabled,
                retentionDays: updates.imageCompression?.retentionDays ?? current.imageCompression?.retentionDays ?? DEFAULT_STORAGE_SETTINGS.imageCompression.retentionDays,
                onlyResolvedTickets: updates.imageCompression?.onlyResolvedTickets ?? current.imageCompression?.onlyResolvedTickets ?? DEFAULT_STORAGE_SETTINGS.imageCompression.onlyResolvedTickets,
                quality: updates.imageCompression?.quality ?? current.imageCompression?.quality ?? DEFAULT_STORAGE_SETTINGS.imageCompression.quality,
                maxWidth: updates.imageCompression?.maxWidth ?? current.imageCompression?.maxWidth ?? DEFAULT_STORAGE_SETTINGS.imageCompression.maxWidth,
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
        // P1 perf: called by every ticket-form render. Cache 60s.
        return this.cacheService.getOrSet(
            'settings:scheduling',
            async () => {
                const config = await this.getSetting<SchedulingConfig>('scheduling.config');
                return config || DEFAULT_SCHEDULING_CONFIG;
            },
            60,
        );
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

        // Invalidate scheduling cache so the next read picks up the change
        await this.cacheService.delAsync('settings:scheduling').catch(() => undefined);

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

        // Invalidate scheduling cache
        await this.cacheService.delAsync('settings:scheduling').catch(() => undefined);

        return updated;
    }
}
