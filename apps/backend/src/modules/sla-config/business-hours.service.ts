import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessHours } from './entities/business-hours.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

// Indonesian National Holidays for 2025
const INDONESIAN_HOLIDAYS_2025 = [
    // Tahun Baru
    '2025-01-01',
    // Isra Mi'raj
    '2025-01-27',
    // Imlek
    '2025-01-29',
    // Hari Raya Nyepi
    '2025-03-29',
    // Wafat Isa Al-Masih
    '2025-04-18',
    // Hari Raya Idul Fitri (Lebaran)
    '2025-03-31',
    '2025-04-01',
    // Cuti Bersama Lebaran (perkiraan)
    '2025-03-28',
    '2025-04-02',
    '2025-04-03',
    '2025-04-04',
    // Hari Buruh
    '2025-05-01',
    // Kenaikan Isa Al-Masih
    '2025-05-29',
    // Hari Raya Waisak
    '2025-05-12',
    // Pancasila
    '2025-06-01',
    // Hari Raya Idul Adha
    '2025-06-07',
    // Tahun Baru Islam
    '2025-06-27',
    // Hari Kemerdekaan
    '2025-08-17',
    // Maulid Nabi
    '2025-09-05',
    // Natal
    '2025-12-25',
    // Cuti Bersama Natal
    '2025-12-26',
];

// Indonesian National Holidays for 2026

const INDONESIAN_HOLIDAYS_2026 = [
    // Tahun Baru
    '2026-01-01',
    // Imlek
    '2026-02-17',
    // Isra Mi'raj (perkiraan)
    '2026-01-16',
    // Hari Raya Nyepi
    '2026-03-19',
    // Wafat Isa Al-Masih
    '2026-04-03',
    // Hari Raya Idul Fitri
    '2026-03-20',
    '2026-03-21',
    // Hari Buruh
    '2026-05-01',
    // Kenaikan Isa Al-Masih
    '2026-05-14',
    // Hari Raya Waisak
    '2026-05-31',
    // Pancasila
    '2026-06-01',
    // Hari Raya Idul Adha
    '2026-05-27',
    // Tahun Baru Islam
    '2026-06-17',
    // Hari Kemerdekaan
    '2026-08-17',
    // Maulid Nabi
    '2026-08-26',
    // Natal
    '2026-12-25',
];

const DEFAULT_HOLIDAYS = [...INDONESIAN_HOLIDAYS_2025, ...INDONESIAN_HOLIDAYS_2026];

@Injectable()
export class BusinessHoursService {
    private readonly logger = new Logger(BusinessHoursService.name);

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
        let config = await this.repo.findOne({ where: { isDefault: true } });

        if (!config) {
            // Create default configuration with Indonesian holidays
            config = this.repo.create({
                name: 'default',
                isDefault: true,
                workDays: [1, 2, 3, 4, 5],  // Mon-Fri
                startTime: 480,  // 8:00 AM
                endTime: 1020,   // 5:00 PM
                timezone: 'Asia/Jakarta',
                holidays: DEFAULT_HOLIDAYS,
            });
            await this.repo.save(config);
            this.logger.log('Created default business hours configuration with Indonesian holidays');
        }

        return config;
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
     * Calculate SLA target considering business hours
     * @param startTime - When the SLA clock starts
     * @param minutesToAdd - Total business minutes to add
     * @returns Target date/time
     */
    async calculateSlaTarget(startTime: Date, minutesToAdd: number): Promise<Date> {
        const config = await this.getDefault();
        let current = new Date(startTime);
        let remainingMinutes = minutesToAdd;

        // Safety limit to prevent infinite loops
        const maxIterations = 365; // Max 1 year of iterations
        let iterations = 0;

        while (remainingMinutes > 0 && iterations < maxIterations) {
            iterations++;

            // Skip if not a work day
            if (!this.isWorkDay(current, config)) {
                current.setDate(current.getDate() + 1);
                current.setHours(Math.floor(config.startTime / 60), config.startTime % 60, 0, 0);
                continue;
            }

            const currentMinutes = current.getHours() * 60 + current.getMinutes();

            // Before work hours - jump to start
            if (currentMinutes < config.startTime) {
                current.setHours(Math.floor(config.startTime / 60), config.startTime % 60, 0, 0);
            }
            // After work hours - jump to next day
            else if (currentMinutes >= config.endTime) {
                current.setDate(current.getDate() + 1);
                current.setHours(Math.floor(config.startTime / 60), config.startTime % 60, 0, 0);
                continue;
            }

            // Calculate remaining minutes in current work day
            const currentMinsInDay = current.getHours() * 60 + current.getMinutes();
            const minutesLeftToday = config.endTime - currentMinsInDay;

            if (remainingMinutes <= minutesLeftToday) {
                // Finish within today
                current.setMinutes(current.getMinutes() + remainingMinutes);
                remainingMinutes = 0;
            } else {
                // Move to next day
                remainingMinutes -= minutesLeftToday;
                current.setDate(current.getDate() + 1);
                current.setHours(Math.floor(config.startTime / 60), config.startTime % 60, 0, 0);
            }
        }

        if (iterations >= maxIterations) {
            this.logger.warn('SLA calculation exceeded max iterations, returning approximate target');
        }

        return current;
    }

    /**
     * Check if a date is a work day
     */
    private isWorkDay(date: Date, config: BusinessHours): boolean {
        const dayOfWeek = date.getDay();

        // Check if it's a work day
        if (!config.workDays.includes(dayOfWeek)) {
            return false;
        }

        // Check if it's a holiday
        const dateStr = this.formatDate(date);
        if (config.holidays?.includes(dateStr)) {
            return false;
        }

        return true;
    }

    /**
     * Format date as YYYY-MM-DD
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Calculate business minutes between two dates
     */
    async calculateBusinessMinutes(startDate: Date, endDate: Date): Promise<number> {
        const config = await this.getDefault();
        let current = new Date(startDate);
        let totalMinutes = 0;

        const maxIterations = 365;
        let iterations = 0;

        while (current < endDate && iterations < maxIterations) {
            iterations++;

            if (!this.isWorkDay(current, config)) {
                current.setDate(current.getDate() + 1);
                current.setHours(Math.floor(config.startTime / 60), config.startTime % 60, 0, 0);
                continue;
            }

            const currentMinutes = current.getHours() * 60 + current.getMinutes();
            const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

            // Get effective start for this day
            const dayStart = Math.max(currentMinutes, config.startTime);

            // Check if end date is same day
            if (this.formatDate(current) === this.formatDate(endDate)) {
                const dayEnd = Math.min(endMinutes, config.endTime);
                if (dayEnd > dayStart) {
                    totalMinutes += dayEnd - dayStart;
                }
                break;
            } else {
                // Full work day
                if (dayStart < config.endTime) {
                    totalMinutes += config.endTime - dayStart;
                }
                current.setDate(current.getDate() + 1);
                current.setHours(Math.floor(config.startTime / 60), config.startTime % 60, 0, 0);
            }
        }

        return totalMinutes;
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
