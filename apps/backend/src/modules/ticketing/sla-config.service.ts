import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SlaConfig } from './entities/sla-config.entity';
import { TicketPriority } from './entities/ticket.entity';

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
            const defaults = [
                { priority: TicketPriority.LOW, resolutionTimeMinutes: 2880 }, // 48h
                { priority: TicketPriority.MEDIUM, resolutionTimeMinutes: 1440 }, // 24h
                { priority: TicketPriority.HIGH, resolutionTimeMinutes: 480 }, // 8h
                { priority: TicketPriority.CRITICAL, resolutionTimeMinutes: 120 }, // 2h
            ];
            await this.slaConfigRepo.save(defaults);
            console.log('Seeded default SLA configurations');
        }
    }

    async findAll(): Promise<SlaConfig[]> {
        return this.slaConfigRepo.find({ order: { resolutionTimeMinutes: 'ASC' } }); // Or custom order
    }

    async update(id: string, resolutionTimeMinutes: number): Promise<SlaConfig> {
        await this.slaConfigRepo.update(id, { resolutionTimeMinutes });
        return this.slaConfigRepo.findOne({ where: { id } });
    }
}
