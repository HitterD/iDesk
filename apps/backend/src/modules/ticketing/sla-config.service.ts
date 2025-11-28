import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaConfig } from './entities/sla-config.entity';
import { TicketPriority } from './entities/ticket.entity';

const DEFAULT_SLA_CONFIGS = [
    { priority: 'LOW', resolutionTimeMinutes: 2880, responseTimeMinutes: 480 }, // 2 days resolution, 8h response
    { priority: 'MEDIUM', resolutionTimeMinutes: 1440, responseTimeMinutes: 240 }, // 1 day resolution, 4h response
    { priority: 'HIGH', resolutionTimeMinutes: 480, responseTimeMinutes: 60 }, // 8h resolution, 1h response
    { priority: 'CRITICAL', resolutionTimeMinutes: 120, responseTimeMinutes: 15 }, // 2h resolution, 15min response
];

@Injectable()
export class SlaConfigService implements OnModuleInit {
    constructor(
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
    ) { }

    async onModuleInit() {
        await this.seedDefaults();
    }

    async seedDefaults() {
        const count = await this.slaConfigRepo.count();
        if (count === 0) {
            await this.slaConfigRepo.save(DEFAULT_SLA_CONFIGS);
            console.log('Seeded default SLA configurations');
        }
    }

    async findAll(): Promise<SlaConfig[]> {
        // Custom priority order
        const priorityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        const configs = await this.slaConfigRepo.find();
        return configs.sort((a, b) => {
            const aIndex = priorityOrder.indexOf(a.priority);
            const bIndex = priorityOrder.indexOf(b.priority);
            return aIndex - bIndex;
        });
    }

    async findByPriority(priority: string): Promise<SlaConfig | null> {
        return this.slaConfigRepo.findOne({ where: { priority } });
    }

    async update(id: string, data: { resolutionTimeMinutes?: number; responseTimeMinutes?: number }): Promise<SlaConfig> {
        const updateData: any = {};
        if (data.resolutionTimeMinutes !== undefined) {
            updateData.resolutionTimeMinutes = data.resolutionTimeMinutes;
        }
        if (data.responseTimeMinutes !== undefined) {
            updateData.responseTimeMinutes = data.responseTimeMinutes;
        }
        await this.slaConfigRepo.update(id, updateData);
        return this.slaConfigRepo.findOne({ where: { id } });
    }

    async create(priority: string, resolutionTimeMinutes: number, responseTimeMinutes?: number): Promise<SlaConfig> {
        const existing = await this.slaConfigRepo.findOne({ where: { priority: priority.toUpperCase() } });
        if (existing) {
            throw new BadRequestException('SLA Configuration for this priority already exists');
        }
        const config = this.slaConfigRepo.create({ 
            priority: priority.toUpperCase(), 
            resolutionTimeMinutes,
            responseTimeMinutes: responseTimeMinutes || 60,
        });
        return this.slaConfigRepo.save(config);
    }

    async resetToDefaults(): Promise<SlaConfig[]> {
        // Delete all existing configs
        await this.slaConfigRepo.clear();
        // Create defaults
        await this.slaConfigRepo.save(DEFAULT_SLA_CONFIGS);
        return this.findAll();
    }

    async delete(id: string): Promise<void> {
        await this.slaConfigRepo.delete(id);
    }
}
