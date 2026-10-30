import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessHours } from './entities/business-hours.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

import { DEFAULT_HOLIDAYS } from './default-holidays';
import { addBusinessMinutes, businessMinutesBetween, BusinessSchedule, DEFAULT_TIMEZONE } from './business-hours.calc';

const SCHEDULE_CACHE_TTL_MS = 60_000;

/** Plain schedule used by the pure calculations. */
export function toBusinessSchedule(config: BusinessHours): BusinessSchedule {
    return {
        workDays: config.workDays ?? [],
        startTime: config.startTime,
        endTime: config.endTime,
        timezone: config.timezone || DEFAULT_TIMEZONE,
        holidays: config.holidays ?? [],
    };
}

@Injectable()
export class BusinessHoursService {
    private readonly logger = new Logger(BusinessHoursService.name);
    /** SLA math reads the schedule on every ticket mutation; it rarely changes. */
    private cached: { config: BusinessHours; expiresAt: number } | null = null;

    constructor(
        @InjectRepository(BusinessHours)
        private readonly repo: Repository<BusinessHours>,
        private readonly auditService: AuditService,
    ) { }

    /**
     * Get default business hours configuration
     * Creates default if not exists
     */
    async getDefault(): Promise<BusinessHours> {
        if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.config;
        let config = await this.repo.findOne({ where: { isDefault: true } });

        if (!config) {
            // Create default configuration with Indonesian holidays
            config = this.repo.create({
                name: 'default',
                isDefault: true,
                workDays: [1, 2, 3, 4, 5],  // Mon-Fri
                startTime: 480,  // 8:00 AM
                endTime: 1020,   // 5:00 PM
                timezone: DEFAULT_TIMEZONE,
                holidays: DEFAULT_HOLIDAYS,
            });
            await this.repo.save(config);
            this.logger.log('Created default business hours configuration with Indonesian holidays');
        }

        this.cached = { config, expiresAt: Date.now() + SCHEDULE_CACHE_TTL_MS };
        return config;
    }

    /** Default schedule as plain data for the pure calculations. */
    async getSchedule(): Promise<BusinessSchedule> {
        return toBusinessSchedule(await this.getDefault());
    }

    /**
     * Get all business hours configurations
     */
    async findAll(): Promise<BusinessHours[]> {
        return this.repo.find({ order: { name: 'ASC' } });
    }

    /**
     * Update business hours configuration
     */
    async update(id: string, data: Partial<BusinessHours>, userId?: string): Promise<BusinessHours> {
        const oldValue = await this.repo.findOne({ where: { id } });
        await this.repo.update(id, data);
        this.cached = null;
        const saved = await this.repo.findOne({ where: { id } });

        if (userId && saved && oldValue) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.BUSINESS_HOURS_UPDATE,
                entityType: 'BusinessHours',
                entityId: id,
                description: `Updated business hours`,
                oldValue,
                newValue: data,
            });
        }

        if (!saved) throw new Error('BusinessHours configuration not found');
        return saved;
    }

    /**
     * Add holiday to configuration
     */
    async addHoliday(id: string, date: string, userId?: string): Promise<BusinessHours> {
        const config = await this.repo.findOne({ where: { id } });
        if (config && !config.holidays.includes(date)) {
            config.holidays.push(date);
            config.holidays.sort();
            await this.repo.save(config);
            this.cached = null;

            if (userId) {
                this.auditService.logAsync({
                    userId,
                    action: AuditAction.BUSINESS_HOURS_UPDATE,
                    entityType: 'BusinessHours',
                    entityId: id,
                    description: `Added holiday: ${date}`,
                    newValue: { addedHoliday: date },
                });
            }
        }
        if (!config) throw new Error("Not found");
        return config;
    }

    /**
     * Remove holiday from configuration
     */
    async removeHoliday(id: string, date: string, userId?: string): Promise<BusinessHours> {
        const config = await this.repo.findOne({ where: { id } });
        if (config) {
            config.holidays = config.holidays.filter(h => h !== date);
            await this.repo.save(config);
            this.cached = null;

            if (userId) {
                this.auditService.logAsync({
                    userId,
                    action: AuditAction.HOLIDAY_REMOVE,
                    entityType: 'BusinessHours',
                    entityId: id,
                    description: `Removed holiday: ${date}`,
                    newValue: { removedHoliday: date },
                });
            }
        }
        if (!config) throw new Error("Not found");
        return config;
    }

    /**
     * Instant reached after `minutesToAdd` working minutes from `startTime`,
     * evaluated in the schedule's timezone.
     */
    async calculateSlaTarget(startTime: Date, minutesToAdd: number): Promise<Date> {
        if (!minutesToAdd || minutesToAdd <= 0 || !Number.isFinite(minutesToAdd)) {
            return new Date(startTime);
        }
        return addBusinessMinutes(startTime, minutesToAdd, toBusinessSchedule(await this.getDefault()));
    }

    /**
     * Working minutes between two instants
     */
    async calculateBusinessMinutes(startDate: Date, endDate: Date): Promise<number> {
        if (!startDate || !endDate) return 0;
        return businessMinutesBetween(startDate, endDate, toBusinessSchedule(await this.getDefault()));
    }

    /**
     * Get helper data for frontend
     */
    getFormattedHours(config: BusinessHours): { startFormatted: string; endFormatted: string } {
        const startHours = Math.floor(config.startTime / 60);
        const startMins = config.startTime % 60;
        const endHours = Math.floor(config.endTime / 60);
        const endMins = config.endTime % 60;

        return {
            startFormatted: `${String(startHours).padStart(2, '0')}:${String(startMins).padStart(2, '0')}`,
            endFormatted: `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`,
        };
    }
}
